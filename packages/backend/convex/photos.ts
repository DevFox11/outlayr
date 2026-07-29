import { R2 } from "@convex-dev/r2";
import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import {
	action,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { isPhotoName, ownsPhotoKey, photoKeyFor } from "./lib/photoKeys";

/**
 * Transaction photo bytes, which travel outside `sync.ts` entirely.
 *
 * The replication stream is small records merge-sorted by `seq`; a JPEG in that
 * stream would blow the mutation size limit and stall every other table behind
 * it. What replicates is the object key (`transactions.imageKey`); the bytes go
 * straight from the device to R2 over a signed url and come back the same way.
 *
 * Requires four Convex environment variables, read by the component itself:
 * `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
 * The client is constructed lazily, so a deployment missing them serves every
 * other function normally and fails only here.
 */
const r2 = new R2(components.r2);

/**
 * How long a minted read url stays valid. Longer than the component's 900s
 * default because a device downloads a backlog of photos in one pass and the
 * slowest of them must not outlive its own url; far short of the seven-day
 * ceiling because the url is the only thing standing between a leaked link and
 * the object.
 */
export const PHOTO_URL_TTL_SECONDS = 3600;

/** A device asks for at most this many read urls per call. */
export const PHOTO_URL_BATCH_LIMIT = 100;

/**
 * Photo storage is free and ungated, matching `sync.ts`. A per-account byte
 * limit belongs here, immediately after `requireUserId` and before a url is
 * minted — the component's metadata table records `size` per object, so the
 * account's total is `r2.listMetadata` over this user's prefix. Refusing at
 * upload-url time is the only refusal a client cannot route around: once it
 * holds a signed PUT the bytes are already R2's problem.
 */
async function checkPhotoQuota(_ctx: QueryCtx, _userId: string): Promise<void> {
	return;
}

/**
 * Answers the signed PUT a device uploads through, and the key to record.
 *
 * The key is derived from the file name rather than allocated, so an upload
 * that dies mid-PUT is retried onto the same key. That is what keeps a retry
 * from leaving bytes nothing will ever reference — R2 has no transaction to
 * roll back, so the only safe retry is an idempotent one.
 */
export const requestUpload = mutation({
	args: { name: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		await checkPhotoQuota(ctx, userId);
		if (!isPhotoName(args.name)) {
			throw new ConvexError(`Not a photo file name: ${args.name}`);
		}
		return await r2.generateUploadUrl(photoKeyFor(userId, args.name));
	},
});

/**
 * The ownership seam reached from an action, which has no `db` of its own and
 * so cannot validate a session row directly.
 */
export const callerId = internalQuery({
	args: {},
	returns: v.string(),
	handler: async (ctx) => await requireUserId(ctx),
});

/**
 * Records size and content type for an object the device has finished PUTting.
 *
 * An action rather than a mutation because that is what `syncMetadata` requires
 * — it reads the object back out of R2. Skipping the call costs only the
 * metadata row, so a device that crashes between the PUT and this call has a
 * durable photo with no accounting, which the next upload of the same key
 * repairs.
 */
export const confirmUpload = action({
	args: { key: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId: string = await ctx.runQuery(internal.photos.callerId, {});
		if (!ownsPhotoKey(userId, args.key)) {
			throw new ConvexError("That photo does not belong to this account");
		}
		await r2.syncMetadata(ctx, args.key);
		return null;
	},
});

/**
 * Short-lived read urls for keys this account owns.
 *
 * Minted per read and never stored: `getUrl` signs a url that expires, so a
 * url written to a row would be a reference that rots. A key the caller does
 * not own is dropped rather than refused, so one stale key in a batch does not
 * cost a device the whole page of photos.
 */
export const readUrls = query({
	args: { keys: v.array(v.string()) },
	returns: v.array(v.object({ key: v.string(), url: v.string() })),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (args.keys.length > PHOTO_URL_BATCH_LIMIT) {
			throw new ConvexError(
				`A read asks for at most ${PHOTO_URL_BATCH_LIMIT} urls; got ${args.keys.length}`,
			);
		}

		const owned = args.keys.filter((key) => ownsPhotoKey(userId, key));
		return await Promise.all(
			owned.map(async (key) => ({
				key,
				url: await r2.getUrl(key, { expiresIn: PHOTO_URL_TTL_SECONDS }),
			})),
		);
	},
});

/**
 * Whether any row in the account still names `key`.
 *
 * Tombstoned rows count. A tombstone is what the undo window restores from and
 * what a device that has not pulled yet is still rendering, so treating one as
 * unreferenced would delete bytes two live readers can name.
 */
async function isReferenced(
	ctx: MutationCtx,
	userId: string,
	key: string,
): Promise<boolean> {
	const rows = await ctx.db
		.query("transactions")
		.withIndex("by_user_and_seq", (q) => q.eq("userId", userId))
		.collect();
	return rows.some((row) => row.imageKey === key);
}

/**
 * Frees an object no row names any more.
 *
 * The delete is deliberately NOT transactional with the tombstone that made the
 * photo unreferenced, and cannot be: R2 is a separate system, and
 * `r2.deleteObject` removes the metadata row synchronously but hands the object
 * removal to a retrier. So the ordering is chosen for which failure is
 * survivable — the reference is dropped first, the bytes after. A crash in
 * between leaks an object, which costs storage and is reclaimable by calling
 * this again. The reverse order would leave a row naming bytes that no longer
 * exist, which is a photo the user watches disappear.
 *
 * A device that is mid-download when this lands gets a 404 on a url it already
 * holds. That is the race, it is not closable, and the device treats it exactly
 * as it treats a photo it has not fetched yet: the row keeps its key, no local
 * file appears, and the identity tile falls back. Nothing errors and the next
 * pass retries.
 */
export const releaseUnreferenced = mutation({
	args: { key: v.string() },
	returns: v.object({ released: v.boolean() }),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (!ownsPhotoKey(userId, args.key)) {
			throw new ConvexError("That photo does not belong to this account");
		}
		if (await isReferenced(ctx, userId, args.key)) {
			return { released: false };
		}
		await r2.deleteObject(ctx, args.key);
		return { released: true };
	},
});
