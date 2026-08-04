import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

/**
 * `lookup`/`record`/`purge` are all `internal*` and stay that way — a public
 * exact-key oracle over a shared, non-user-scoped table is a
 * dictionary-enumeration surface (threat T5). `lookup` is reachable only from
 * `enrichment.ts:suggest`; no function here collects or paginates a listing
 * over `by_key`, or takes a prefix/range.
 */

const knowledgeFields = {
	domain: v.string(),
	categoryName: v.string(),
	parentCategoryName: v.union(v.string(), v.null()),
	emoji: v.union(v.string(), v.null()),
	tags: v.array(v.string()),
	logoKey: v.union(v.string(), v.null()),
	modelId: v.string(),
};

const knowledgeRecord = v.object({
	key: v.string(),
	resolvedAt: v.number(),
	...knowledgeFields,
});

export const lookup = internalQuery({
	args: { key: v.string() },
	returns: v.union(knowledgeRecord, v.null()),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("merchantKnowledge")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.unique();
		if (row === null) {
			return null;
		}
		return {
			key: row.key,
			resolvedAt: row.resolvedAt,
			domain: row.domain,
			categoryName: row.categoryName,
			parentCategoryName: row.parentCategoryName,
			emoji: row.emoji,
			tags: row.tags,
			logoKey: row.logoKey,
			modelId: row.modelId,
		};
	},
});

export const record = internalMutation({
	args: {
		key: v.string(),
		resolvedAt: v.number(),
		...knowledgeFields,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("merchantKnowledge")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.unique();
		if (existing === null) {
			await ctx.db.insert("merchantKnowledge", args);
		} else {
			await ctx.db.patch("merchantKnowledge", existing._id, args);
		}
		return null;
	},
});

export const purge = internalMutation({
	args: { key: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("merchantKnowledge")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.unique();
		if (existing !== null) {
			await ctx.db.delete("merchantKnowledge", existing._id);
		}
		return null;
	},
});
