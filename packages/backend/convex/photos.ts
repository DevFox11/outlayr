import { R2 } from "@convex-dev/r2";
import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
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
 * Two backends, chosen per deployment. R2 when all four of `R2_BUCKET`,
 * `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are set;
 * Convex file storage otherwise, so a deployment with no R2 account still
 * syncs photos rather than failing every upload.
 *
 * The *key* is identical either way — derived from the device file name and
 * carrying the owner — so the wire format, `transactions.imageKey` and the
 * ownership check do not know which backend stored the bytes. Convex file
 * storage allocates its own id, so that id is mapped back to the key in
 * `photoObjects`; R2 needs no mapping because its key is the address.
 *
 * A row is therefore readable by whichever backend stored it, which is what
 * makes turning R2 on later safe: existing photos keep resolving.
 */
const r2 = new R2(components.r2);

/**
 * Read at call time rather than at module scope: a deployment that gains its R2
 * variables should start using them on the next call, not the next cold start.
 */
function usingR2(): boolean {
	return (
		!!process.env.R2_BUCKET &&
		!!process.env.R2_ENDPOINT &&
		!!process.env.R2_ACCESS_KEY_ID &&
		!!process.env.R2_SECRET_ACCESS_KEY
	);
}

/** The Convex-storage id for `key`, or null when R2 holds the bytes. */
async function storageIdFor(
	ctx: QueryCtx,
	key: string,
): Promise<Id<"_storage"> | null> {
	const row = await ctx.db
		.query("photoObjects")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();
	return row ? row.storageId : null;
}

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
		const key = photoKeyFor(userId, args.name);
		if (usingR2()) {
			return await r2.generateUploadUrl(key);
		}
		return { key, url: await ctx.storage.generateUploadUrl() };
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
	args: { key: v.string(), storageId: v.optional(v.id("_storage")) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const userId: string = await ctx.runQuery(internal.photos.callerId, {});
		if (!ownsPhotoKey(userId, args.key)) {
			throw new ConvexError("That photo does not belong to this account");
		}
		if (args.storageId) {
			// Convex storage allocated the address, so the key only resolves through
			// the mapping this records.
			await ctx.runMutation(internal.photos.mapStorageId, {
				key: args.key,
				storageId: args.storageId,
			});
			return null;
		}
		await r2.syncMetadata(ctx, args.key);
		return null;
	},
});

/**
 * Binds a Convex-storage id to its key. Re-uploading the same name replaces the
 * mapping and frees the object it displaced, which is what keeps a retry from
 * leaving bytes nothing will ever name — R2 gets that for free from an
 * idempotent key, and this is the Convex-storage equivalent.
 */
export const mapStorageId = internalMutation({
	args: { key: v.string(), storageId: v.id("_storage") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("photoObjects")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.unique();
		if (existing) {
			if (existing.storageId !== args.storageId) {
				await ctx.storage.delete(existing.storageId);
				await ctx.db.patch(existing._id, { storageId: args.storageId });
			}
			return null;
		}
		await ctx.db.insert("photoObjects", {
			key: args.key,
			storageId: args.storageId,
		});
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
		const minted = await Promise.all(
			owned.map(async (key) => {
				// Routed per key, not per deployment: a photo stored before R2 was
				// switched on still resolves through the backend that holds it.
				const storageId = await storageIdFor(ctx, key);
				const url = storageId
					? await ctx.storage.getUrl(storageId)
					: await r2.getUrl(key, { expiresIn: PHOTO_URL_TTL_SECONDS });
				return url === null ? null : { key, url };
			}),
		);
		return minted.filter((entry): entry is { key: string; url: string } =>
			Boolean(entry),
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
		const mapping = await ctx.db
			.query("photoObjects")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.unique();
		if (mapping) {
			// Same ordering as the R2 branch: the reference goes before the bytes,
			// so a crash between them leaks an object rather than leaving a row
			// naming bytes that no longer exist.
			await ctx.db.delete(mapping._id);
			await ctx.storage.delete(mapping.storageId);
			return { released: true };
		}
		await r2.deleteObject(ctx, args.key);
		return { released: true };
	},
});
