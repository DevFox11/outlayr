import { R2 } from "@convex-dev/r2";
import { ConvexError, v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { isPhotoName, ownsPhotoKey, photoKeyFor, photoOwnerFromKey } from "./lib/photoKeys";

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
async function storageIdFor(ctx: QueryCtx, key: string): Promise<Id<"_storage"> | null> {
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
 * What one account may keep in photos.
 *
 * Generous on purpose: a ledger's photos are receipts, and the number exists to
 * bound a storage bill nobody is watching rather than to ration anything a real
 * user does. Raising it is a one-line change that frees every account at once;
 * lowering it strands accounts already above the line, so it should only ever
 * move up.
 */
export const PHOTO_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Refused before a url is minted, which is the only refusal a client cannot
 * route around: once it holds a signed PUT the bytes are already R2's problem.
 *
 * The total is summed from `photoSizes` rather than from the bucket:
 * `r2.listMetadata` takes only a limit and a cursor, so there is no prefix to
 * scope it by and it would page through every object of every account to answer
 * one upload.
 *
 * The check is `>=`, so an account exactly at the ceiling cannot start another
 * upload. It bounds what is *already stored*, not what this upload will add:
 * the size is not known until the bytes exist, and asking the device is asking
 * the one party with a reason to understate it.
 */
async function checkPhotoQuota(ctx: QueryCtx, userId: string): Promise<void> {
    const stored = await ctx.db
        .query("photoSizes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    const used = stored.reduce((total, row) => total + row.bytes, 0);
    if (used >= PHOTO_QUOTA_BYTES) {
        throw new ConvexError({
            code: "PHOTO_QUOTA_EXCEEDED",
            limit: PHOTO_QUOTA_BYTES,
            used,
        });
    }
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
    returns: v.object({ key: v.string(), url: v.string() }),
});

/**
 * The ownership seam reached from an action, which has no `db` of its own and
 * so cannot validate a session row directly.
 */
export const callerId = internalQuery({
    args: {},
    handler: async (ctx) => await requireUserId(ctx),
    returns: v.string(),
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
    handler: async (ctx, args) => {
        const userId: string = await ctx.runQuery(internal.photos.callerId, {});
        if (!ownsPhotoKey(userId, args.key)) {
            throw new ConvexError("That photo does not belong to this account");
        }
        if (args.storageId) {
            // Convex storage allocated the address, so the key only resolves through
            // the mapping this records. It reads the size back from the system table
            // in the same mutation, which is the only place it is known.
            await ctx.runMutation(internal.photos.mapStorageId, {
                key: args.key,
                storageId: args.storageId,
            });
            return null;
        }
        await r2.syncMetadata(ctx, args.key);
        // Read after the sync, or the component has no metadata row to answer from.
        // A missing size records zero rather than refusing: an object that cannot be
        // weighed must still be readable, and undercounting a quota is recoverable
        // where losing a photo is not.
        const metadata = await r2.getMetadata(ctx, args.key);
        await ctx.runMutation(internal.photos.recordPhotoSize, {
            bytes: metadata?.size ?? 0,
            key: args.key,
        });
        return null;
    },
    returns: v.null(),
});

/**
 * Records what an object weighs, so `checkPhotoQuota` never has to ask R2.
 *
 * Upserted by key: re-uploading a name replaces the object, and the row has to
 * be replaced with it rather than added to.
 */
export const recordPhotoSize = internalMutation({
    args: { bytes: v.number(), key: v.string() },
    handler: async (ctx, args) => {
        await writePhotoSize(ctx, args.key, args.bytes);
        return null;
    },
    returns: v.null(),
});

/**
 * A malformed key records nothing rather than throwing: it can only arrive from
 * a caller that already passed the ownership check, so there is nothing for the
 * user to act on, and failing here would fail an upload whose bytes are safely
 * stored.
 */
async function writePhotoSize(ctx: MutationCtx, key: string, bytes: number): Promise<void> {
    const userId = photoOwnerFromKey(key);
    if (userId === null) {
        return;
    }
    const existing = await ctx.db
        .query("photoSizes")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
    if (existing) {
        await ctx.db.patch(existing._id, { bytes });
        return;
    }
    await ctx.db.insert("photoSizes", { bytes, key, userId });
}

/** Drops the accounting for an object whose bytes are gone. */
async function forgetPhotoSize(ctx: MutationCtx, key: string): Promise<void> {
    const row = await ctx.db
        .query("photoSizes")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
    if (row) {
        await ctx.db.delete(row._id);
    }
}

/**
 * Binds a Convex-storage id to its key. Re-uploading the same name replaces the
 * mapping and frees the object it displaced, which is what keeps a retry from
 * leaving bytes nothing will ever name — R2 gets that for free from an
 * idempotent key, and this is the Convex-storage equivalent.
 */
export const mapStorageId = internalMutation({
    args: { key: v.string(), storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("photoObjects")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .unique();
        // The system table is the only place a Convex-stored object's size is
        // recorded, and it is readable here, so the accounting is written in the
        // same mutation as the mapping rather than in a second round trip.
        const stored = await ctx.db.system.get(args.storageId);
        await writePhotoSize(ctx, args.key, stored?.size ?? 0);
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
    returns: v.null(),
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
    handler: async (ctx, args) => {
        const userId = await requireUserId(ctx);
        if (args.keys.length > PHOTO_URL_BATCH_LIMIT) {
            throw new ConvexError(`A read asks for at most ${PHOTO_URL_BATCH_LIMIT} urls; got ${args.keys.length}`);
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
            })
        );
        return minted.filter((entry): entry is { key: string; url: string } => Boolean(entry));
    },
    returns: v.array(v.object({ key: v.string(), url: v.string() })),
});

/**
 * Whether any row in the account still names `key`.
 *
 * Every table carrying an `imageKey` has to be asked. The device mints one key
 * shape for all of them — `apps/native/src/data/photo-store-core.ts` lists them
 * — so a table left out here reads as unreferenced and its bytes are freed
 * while a row still points at them.
 *
 * Tombstoned rows count. A tombstone is what the undo window restores from and
 * what a device that has not pulled yet is still rendering, so treating one as
 * unreferenced would delete bytes two live readers can name.
 */
async function isReferenced(ctx: MutationCtx, userId: string, key: string): Promise<boolean> {
    const transactionRows = await ctx.db
        .query("transactions")
        .withIndex("by_user_and_seq", (q) => q.eq("userId", userId))
        .collect();
    if (transactionRows.some((row) => row.imageKey === key)) {
        return true;
    }
    const accountRows = await ctx.db
        .query("accounts")
        .withIndex("by_user_and_seq", (q) => q.eq("userId", userId))
        .collect();
    return accountRows.some((row) => row.imageKey === key);
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
            await forgetPhotoSize(ctx, args.key);
            return { released: true };
        }
        await r2.deleteObject(ctx, args.key);
        await forgetPhotoSize(ctx, args.key);
        return { released: true };
    },
    returns: v.object({ released: v.boolean() }),
});
