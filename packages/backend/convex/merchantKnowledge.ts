import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

/**
 * `lookup`/`record`/`purge` are all `internal*` and stay that way — a public
 * exact-key oracle over a shared, non-user-scoped table is a
 * dictionary-enumeration surface (threat T5). `lookup` is reachable only from
 * `enrichment.ts:suggest` and `csvImport.ts:csvImport`, both rate-limited; no
 * function here collects or paginates a listing
 * over `by_key`, or takes a prefix/range.
 */

const knowledgeFields = {
    categoryName: v.string(),
    domain: v.string(),
    emoji: v.union(v.string(), v.null()),
    modelId: v.string(),
    parentCategoryName: v.union(v.string(), v.null()),
    tags: v.array(v.string()),
};

const knowledgeRecord = v.object({
    key: v.string(),
    resolvedAt: v.number(),
    ...knowledgeFields,
});

export const lookup = internalQuery({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("merchantKnowledge")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .unique();
        if (row === null) {
            return null;
        }
        return {
            categoryName: row.categoryName,
            domain: row.domain,
            emoji: row.emoji,
            key: row.key,
            modelId: row.modelId,
            parentCategoryName: row.parentCategoryName,
            resolvedAt: row.resolvedAt,
            tags: row.tags,
        };
    },
    returns: v.union(knowledgeRecord, v.null()),
});

export const record = internalMutation({
    args: {
        key: v.string(),
        resolvedAt: v.number(),
        ...knowledgeFields,
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("merchantKnowledge")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .unique();
        await (existing === null
            ? ctx.db.insert("merchantKnowledge", args)
            : ctx.db.patch("merchantKnowledge", existing._id, args));
        return null;
    },
    returns: v.null(),
});

export const purge = internalMutation({
    args: { key: v.string() },
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
    returns: v.null(),
});
