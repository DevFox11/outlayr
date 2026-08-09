import { R2 } from "@convex-dev/r2";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { SYNCED_TABLES } from "./lib/syncTables";

const r2 = new R2(components.r2);

/**
 * How much one purge pass removes.
 *
 * Bounded because a mutation has a document budget and a ledger has no upper
 * size: a single pass over a heavy account would fail, and a deletion that fails
 * on the largest accounts is the one that matters most. The caller re-runs until
 * it reports done, so the only cost of a small number is more round trips.
 */
export const PURGE_BATCH = 200;

/**
 * Removes one batch of an account's server-side data, reporting whether any is
 * left.
 *
 * Deliberately NOT a single sweeping delete. Beyond the size limit, a resumable
 * purge is also a retryable one: a pass that dies halfway has still made
 * progress, and running it again finishes the job rather than starting over.
 *
 * Photos go first. They are the only part that lives outside Convex, so they are
 * the only part that can be orphaned by a half-finished purge — an object whose
 * accounting row is gone is invisible to every later pass and would sit in the
 * bucket forever. Ledger rows can always be found again by index.
 */
export const purgeBatch = internalMutation({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const photos = await ctx.db
			.query("photoSizes")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.take(PURGE_BATCH);
		if (photos.length > 0) {
			for (const photo of photos) {
				await releaseObject(ctx, photo.key);
				await ctx.db.delete(photo._id);
			}
			return { done: false, removed: photos.length };
		}

		for (const table of SYNCED_TABLES) {
			const rows = await ctx.db
				.query(table)
				.withIndex("by_user_and_seq", (q) => q.eq("userId", args.userId))
				.take(PURGE_BATCH);
			if (rows.length === 0) {
				continue;
			}
			for (const row of rows) {
				await ctx.db.delete(row._id);
			}
			return { done: false, removed: rows.length };
		}

		// Last, and only once nothing else is left: it is the counter that stamps
		// `seq`, so removing it while rows remain would restart numbering under
		// records that already carry higher ones.
		const state = await ctx.db
			.query("syncState")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.unique();
		if (state) {
			await ctx.db.delete(state._id);
			return { done: true, removed: 1 };
		}
		return { done: true, removed: 0 };
	},
	returns: v.object({ done: v.boolean(), removed: v.number() }),
});

/**
 * Frees the bytes behind a key, whichever backend holds them.
 *
 * Unlike `releaseUnreferenced` this asks no ownership question and checks no
 * references: the account itself is going, so every row that could have named
 * the object is going with it.
 */
async function releaseObject(ctx: MutationCtx, key: string): Promise<void> {
	const mapping = await ctx.db
		.query("photoObjects")
		.withIndex("by_key", (q) => q.eq("key", key))
		.unique();
	if (mapping) {
		await ctx.db.delete(mapping._id);
		await ctx.storage.delete(mapping.storageId);
		return;
	}
	await r2.deleteObject(ctx, key);
}
