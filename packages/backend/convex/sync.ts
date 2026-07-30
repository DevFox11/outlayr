import { ConvexError, type Validator, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import {
	appMetaFields,
	budgetFields,
	categoryFields,
	FIELDS_BY_TABLE,
	incomingWins,
	mainBudgetFields,
	SYNCED_TABLES,
	type SyncedTable,
	templateTransactionFields,
	transactionFields,
} from "./lib/syncTables";

/**
 * Rows a single `push` may carry. Chosen against Convex's per-transaction
 * ceiling of 4,096 index ranges read: this mutation does one
 * `by_user_and_localId` lookup per row, so 500 leaves an 8x margin, and the
 * argument payload at ~400 bytes a row is two orders of magnitude under the
 * 16 MiB limit.
 */
export const PUSH_BATCH_LIMIT = 500;

/** Rows a single `pullSince` page may serve, and the ceiling on `limit`. */
export const PULL_PAGE_LIMIT = 1000;

const tombstone = {
	updatedAt: v.number(),
	deletedAt: v.union(v.number(), v.null()),
};

/**
 * A pushed row names its own table, so one batch can carry edits from all six
 * without the client having to shard by table — the outbox is ordered by when
 * the edit happened, not by which table it landed in, and re-ordering it would
 * be re-ordering causality.
 */
const pushRow = v.union(
	v.object({
		table: v.literal("categories"),
		localId: v.string(),
		...tombstone,
		fields: v.object(categoryFields),
	}),
	v.object({
		table: v.literal("transactions"),
		localId: v.string(),
		...tombstone,
		fields: v.object(transactionFields),
	}),
	v.object({
		table: v.literal("budgets"),
		localId: v.string(),
		...tombstone,
		fields: v.object(budgetFields),
	}),
	v.object({
		table: v.literal("mainBudget"),
		localId: v.string(),
		...tombstone,
		fields: v.object(mainBudgetFields),
	}),
	v.object({
		table: v.literal("templateTransactions"),
		localId: v.string(),
		...tombstone,
		fields: v.object(templateTransactionFields),
	}),
	v.object({
		table: v.literal("appMeta"),
		localId: v.string(),
		updatedAt: v.number(),
		/** Keys are never deleted, so this side of the union has no tombstone. */
		deletedAt: v.null(),
		fields: v.object(appMetaFields),
	}),
);

type PushRow = {
	table: SyncedTable;
	localId: string;
	updatedAt: number;
	deletedAt: number | null;
	fields: Record<string, unknown>;
};

const pulledRow = v.object({
	table: v.union(...SYNCED_TABLES.map((table) => v.literal(table))),
	localId: v.string(),
	seq: v.number(),
	deviceId: v.string(),
	updatedAt: v.number(),
	deletedAt: v.union(v.number(), v.null()),
	fields: v.record(v.string(), v.any()),
});

/**
 * `appMeta` stores its identity in `key` rather than `localId`, so it is the one
 * table the lookup has to special-case. Everything downstream speaks `localId`.
 */
async function findExisting(
	ctx: MutationCtx,
	userId: string,
	row: PushRow,
): Promise<Doc<SyncedTable> | null> {
	if (row.table === "appMeta") {
		return await ctx.db
			.query("appMeta")
			.withIndex("by_user_and_key", (q) =>
				q.eq("userId", userId).eq("key", row.localId),
			)
			.unique();
	}
	return await ctx.db
		.query(row.table)
		.withIndex("by_user_and_localId", (q) =>
			q.eq("userId", userId).eq("localId", row.localId),
		)
		.unique();
}

/**
 * `appMeta` is the one table without a tombstone column, so the merge rule reads
 * it as permanently live and decides on `updatedAt` alone.
 */
function versioned(doc: Doc<SyncedTable>) {
	return {
		updatedAt: doc.updatedAt,
		deletedAt: "deletedAt" in doc ? doc.deletedAt : null,
		deviceId: doc.deviceId,
	};
}

/**
 * The write is a switch rather than one generic call because a runtime table
 * name erases the generated per-table document type, and that type is exactly
 * what catches a payload drifting from `schema.ts`. `existing` was looked up
 * through `row.table`, so its id belongs to the branch it lands in.
 */
async function upsert(
	ctx: MutationCtx,
	row: PushRow,
	existing: Doc<SyncedTable> | null,
	stamp: { userId: string; deviceId: string; seq: number },
): Promise<void> {
	const envelope = {
		userId: stamp.userId,
		localId: row.localId,
		seq: stamp.seq,
		deviceId: stamp.deviceId,
		updatedAt: row.updatedAt,
		deletedAt: row.deletedAt,
	};

	switch (row.table) {
		case "categories": {
			const doc = { ...envelope, ...(row.fields as Doc<"categories">) };
			if (existing) {
				await ctx.db.patch("categories", existing._id as Id<"categories">, doc);
			} else {
				await ctx.db.insert("categories", doc);
			}
			return;
		}
		case "transactions": {
			const doc = { ...envelope, ...(row.fields as Doc<"transactions">) };
			if (existing) {
				await ctx.db.patch(
					"transactions",
					existing._id as Id<"transactions">,
					doc,
				);
			} else {
				await ctx.db.insert("transactions", doc);
			}
			return;
		}
		case "budgets": {
			const doc = { ...envelope, ...(row.fields as Doc<"budgets">) };
			if (existing) {
				await ctx.db.patch("budgets", existing._id as Id<"budgets">, doc);
			} else {
				await ctx.db.insert("budgets", doc);
			}
			return;
		}
		case "mainBudget": {
			const doc = { ...envelope, ...(row.fields as Doc<"mainBudget">) };
			if (existing) {
				await ctx.db.patch("mainBudget", existing._id as Id<"mainBudget">, doc);
			} else {
				await ctx.db.insert("mainBudget", doc);
			}
			return;
		}
		case "tags": {
			const doc = { ...envelope, ...(row.fields as Doc<"tags">) };
			if (existing) {
				await ctx.db.patch("tags", existing._id as Id<"tags">, doc);
			} else {
				await ctx.db.insert("tags", doc);
			}
			return;
		}
		case "transactionTags": {
			const doc = { ...envelope, ...(row.fields as Doc<"transactionTags">) };
			if (existing) {
				await ctx.db.patch(
					"transactionTags",
					existing._id as Id<"transactionTags">,
					doc,
				);
			} else {
				await ctx.db.insert("transactionTags", doc);
			}
			return;
		}
		case "templateTransactions": {
			const doc = {
				...envelope,
				...(row.fields as Doc<"templateTransactions">),
			};
			if (existing) {
				await ctx.db.patch(
					"templateTransactions",
					existing._id as Id<"templateTransactions">,
					doc,
				);
			} else {
				await ctx.db.insert("templateTransactions", doc);
			}
			return;
		}
		case "appMeta": {
			const doc = {
				userId: stamp.userId,
				key: row.localId,
				seq: stamp.seq,
				deviceId: stamp.deviceId,
				updatedAt: row.updatedAt,
				value: (row.fields as { value: string | null }).value,
			};
			if (existing) {
				await ctx.db.patch("appMeta", existing._id as Id<"appMeta">, doc);
			} else {
				await ctx.db.insert("appMeta", doc);
			}
			return;
		}
		default:
			throw new ConvexError(`Unknown sync table: ${String(row.table)}`);
	}
}

/**
 * Replication, both directions. Every function here derives `userId` from the
 * validated session and never from an argument, so one account can neither read
 * nor write another's ledger.
 *
 * Sync is free and ungated today. If it ever becomes an entitlement, the check
 * belongs immediately after `requireUserId` in `push` and `pullSince` — on the
 * server, where a client cannot route around it.
 */
export const push = mutation({
	args: {
		deviceId: v.string(),
		rows: v.array(pushRow),
	},
	returns: v.object({
		accepted: v.number(),
		skipped: v.number(),
		nextSeq: v.number(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.rows.length > PUSH_BATCH_LIMIT) {
			throw new ConvexError(
				`A push carries at most ${PUSH_BATCH_LIMIT} rows; got ${args.rows.length}`,
			);
		}

		const state = await ctx.db
			.query("syncState")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();

		// Starts at 1 so that a cursor of 0 means "nothing read yet" rather than
		// "read everything up to the first row".
		let nextSeq = state?.nextSeq ?? 1;
		let accepted = 0;
		let skipped = 0;

		for (const row of args.rows as PushRow[]) {
			const existing = await findExisting(ctx, userId, row);
			const candidate = {
				updatedAt: row.updatedAt,
				deletedAt: row.deletedAt,
				deviceId: args.deviceId,
			};
			if (!incomingWins(candidate, existing ? versioned(existing) : null)) {
				// The server keeps the winner and the pull hands it back, so a device
				// whose offline edit lost converges without pushing again. Overwriting
				// here instead would strand the winner's edit on a device that has
				// already cleared its outbox.
				skipped += 1;
				continue;
			}

			await upsert(ctx, row, existing, {
				userId,
				deviceId: args.deviceId,
				seq: nextSeq,
			});
			nextSeq += 1;
			accepted += 1;
		}

		// One counter write per batch rather than per row.
		if (accepted > 0) {
			if (state) {
				await ctx.db.patch("syncState", state._id, { nextSeq });
			} else {
				await ctx.db.insert("syncState", { userId, nextSeq });
			}
		}

		return { accepted, skipped, nextSeq };
	},
});

function toWire(table: SyncedTable, doc: Doc<SyncedTable>) {
	const fieldNames = Object.keys(
		FIELDS_BY_TABLE[table] as Record<string, Validator<unknown>>,
	);
	const source = doc as unknown as Record<string, unknown>;
	const fields: Record<string, unknown> = {};
	for (const name of fieldNames) {
		fields[name] = source[name] ?? null;
	}
	return {
		table,
		localId: (source.localId ?? source.key) as string,
		seq: doc.seq,
		deviceId: doc.deviceId,
		updatedAt: doc.updatedAt,
		deletedAt: (source.deletedAt ?? null) as number | null,
		fields,
	};
}

/**
 * One page of the account's change log, strictly after `cursor`.
 *
 * Six index walks merge-sorted into one causally ordered stream. Taking `limit`
 * from each table before the merge is what makes the truncation safe: any row
 * left behind in a table necessarily has a `seq` above the last one served, so
 * the next page picks it up rather than skipping it.
 *
 * The page is NOT ordered so that a category precedes a transaction referencing
 * it — `seq` is last-modified order, and a category edited today sorts after a
 * transaction created against it last year. The applier runs the batch with
 * foreign keys off for exactly this reason.
 */
export const pullSince = query({
	args: {
		cursor: v.number(),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		rows: v.array(pulledRow),
		cursor: v.number(),
		hasMore: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = Math.min(
			Math.max(Math.trunc(args.limit ?? PULL_PAGE_LIMIT), 1),
			PULL_PAGE_LIMIT,
		);

		const pages = await Promise.all(
			SYNCED_TABLES.map((table: SyncedTable) =>
				ctx.db
					.query(table)
					.withIndex("by_user_and_seq", (q) =>
						q.eq("userId", userId).gt("seq", args.cursor),
					)
					.take(limit),
			),
		);

		const merged = pages
			.flatMap((docs, index) =>
				docs.map((doc) => toWire(SYNCED_TABLES[index], doc)),
			)
			.sort((a, b) => a.seq - b.seq);

		const rows = merged.slice(0, limit);
		const last = rows[rows.length - 1];

		return {
			rows,
			cursor: last ? last.seq : args.cursor,
			// A full page may be exactly the tail, in which case the next call
			// serves nothing and the walk stops there — one wasted query, never a
			// missed row.
			hasMore: merged.length >= limit,
		};
	},
});

/**
 * The account's current watermark, subscribed to rather than polled: any
 * device's push moves it, which invalidates this query on every other device
 * and is what makes replication realtime without a poll loop.
 */
export const currentSeq = query({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const state = await ctx.db
			.query("syncState")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return state?.nextSeq ?? 0;
	},
});
