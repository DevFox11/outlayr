import type { WithoutSystemFields } from "convex/server";
import { ConvexError, type Validator, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import {
	accountFields,
	appMetaFields,
	budgetFields,
	categoryFields,
	FIELDS_BY_TABLE,
	incomingWins,
	mainBudgetFields,
	SYNCED_TABLES,
	type SyncedTable,
	tagFields,
	templateTransactionFields,
	transactionFields,
	transactionPhotoFields,
	transactionSplitFields,
	transactionTagFields,
	transferFields,
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
	deletedAt: v.union(v.number(), v.null()),
	updatedAt: v.number(),
};

/**
 * A pushed row names its own table, so one batch can carry edits from every
 * synced table without the client having to shard by table — the outbox is ordered by when
 * the edit happened, not by which table it landed in, and re-ordering it would
 * be re-ordering causality.
 */
const pushRow = v.union(
	v.object({
		localId: v.string(),
		table: v.literal("categories"),
		...tombstone,
		fields: v.object(categoryFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("transactions"),
		...tombstone,
		fields: v.object(transactionFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("budgets"),
		...tombstone,
		fields: v.object(budgetFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("mainBudget"),
		...tombstone,
		fields: v.object(mainBudgetFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("templateTransactions"),
		...tombstone,
		fields: v.object(templateTransactionFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("tags"),
		...tombstone,
		fields: v.object(tagFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("transactionTags"),
		...tombstone,
		fields: v.object(transactionTagFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("transactionPhotos"),
		...tombstone,
		fields: v.object(transactionPhotoFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("transactionSplits"),
		...tombstone,
		fields: v.object(transactionSplitFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("accounts"),
		...tombstone,
		fields: v.object(accountFields),
	}),
	v.object({
		localId: v.string(),
		table: v.literal("transfers"),
		...tombstone,
		fields: v.object(transferFields),
	}),
	v.object({
		/** Keys are never deleted, so this side of the union has no tombstone. */
		deletedAt: v.null(),
		fields: v.object(appMetaFields),
		localId: v.string(),
		table: v.literal("appMeta"),
		updatedAt: v.number(),
	})
);

interface PushRow {
	deletedAt: number | null;
	fields: Record<string, unknown>;
	localId: string;
	table: SyncedTable;
	updatedAt: number;
}

const pulledRow = v.object({
	deletedAt: v.union(v.number(), v.null()),
	deviceId: v.string(),
	fields: v.record(v.string(), v.any()),
	localId: v.string(),
	seq: v.number(),
	table: v.union(...SYNCED_TABLES.map((table) => v.literal(table))),
	updatedAt: v.number(),
});

/**
 * `appMeta` stores its identity in `key` rather than `localId`, so it is the one
 * table the lookup has to special-case. Everything downstream speaks `localId`.
 */
async function findExisting(ctx: MutationCtx, userId: string, row: PushRow): Promise<Doc<SyncedTable> | null> {
	if (row.table === "appMeta") {
		return await ctx.db
			.query("appMeta")
			.withIndex("by_user_and_key", (q) => q.eq("userId", userId).eq("key", row.localId))
			.unique();
	}
	return await ctx.db
		.query(row.table)
		.withIndex("by_user_and_localId", (q) => q.eq("userId", userId).eq("localId", row.localId))
		.unique();
}

/**
 * `appMeta` is the one table without a tombstone column, so the merge rule reads
 * it as permanently live and decides on `updatedAt` alone.
 */
function versioned(doc: Doc<SyncedTable>) {
	return {
		deletedAt: "deletedAt" in doc ? doc.deletedAt : null,
		deviceId: doc.deviceId,
		updatedAt: doc.updatedAt,
	};
}

/**
 * `T` is inferred from the literal each case passes, so `doc` is still checked
 * against that table's own generated document type — the switch below keeps its
 * type safety while costing one line per table instead of six.
 */
async function writeRow<T extends SyncedTable>(
	ctx: MutationCtx,
	table: T,
	existing: Doc<SyncedTable> | null,
	doc: WithoutSystemFields<Doc<T>>
): Promise<void> {
	if (existing) {
		await ctx.db.patch(table, existing._id as Id<T>, doc);
	} else {
		await ctx.db.insert(table, doc);
	}
}

/**
 * A switch rather than one call on `row.table`, because a runtime table name
 * erases the generated per-table document type, and that type is exactly what
 * catches a payload drifting from `schema.ts`. `existing` was looked up through
 * `row.table`, so its id belongs to the branch it lands in.
 */
async function upsert(
	ctx: MutationCtx,
	row: PushRow,
	existing: Doc<SyncedTable> | null,
	stamp: { userId: string; deviceId: string; seq: number }
): Promise<void> {
	const envelope = {
		deletedAt: row.deletedAt,
		deviceId: stamp.deviceId,
		localId: row.localId,
		seq: stamp.seq,
		updatedAt: row.updatedAt,
		userId: stamp.userId,
	};

	switch (row.table) {
		case "categories":
			return await writeRow(ctx, "categories", existing, { ...envelope, ...(row.fields as Doc<"categories">) });
		case "transactions":
			return await writeRow(ctx, "transactions", existing, { ...envelope, ...(row.fields as Doc<"transactions">) });
		case "budgets":
			return await writeRow(ctx, "budgets", existing, { ...envelope, ...(row.fields as Doc<"budgets">) });
		case "mainBudget":
			return await writeRow(ctx, "mainBudget", existing, { ...envelope, ...(row.fields as Doc<"mainBudget">) });
		case "tags":
			return await writeRow(ctx, "tags", existing, { ...envelope, ...(row.fields as Doc<"tags">) });
		case "transactionTags":
			return await writeRow(ctx, "transactionTags", existing, {
				...envelope,
				...(row.fields as Doc<"transactionTags">),
			});
		case "transactionPhotos":
			return await writeRow(ctx, "transactionPhotos", existing, {
				...envelope,
				...(row.fields as Doc<"transactionPhotos">),
			});
		case "transactionSplits":
			return await writeRow(ctx, "transactionSplits", existing, {
				...envelope,
				...(row.fields as Doc<"transactionSplits">),
			});
		case "accounts":
			return await writeRow(ctx, "accounts", existing, { ...envelope, ...(row.fields as Doc<"accounts">) });
		case "transfers":
			return await writeRow(ctx, "transfers", existing, { ...envelope, ...(row.fields as Doc<"transfers">) });
		case "templateTransactions":
			return await writeRow(ctx, "templateTransactions", existing, {
				...envelope,
				...(row.fields as Doc<"templateTransactions">),
			});
		case "appMeta": {
			const doc = {
				deviceId: stamp.deviceId,
				key: row.localId,
				seq: stamp.seq,
				updatedAt: row.updatedAt,
				userId: stamp.userId,
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
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);

		if (args.rows.length > PUSH_BATCH_LIMIT) {
			throw new ConvexError(`A push carries at most ${PUSH_BATCH_LIMIT} rows; got ${args.rows.length}`);
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
			// biome-ignore lint/performance/noAwaitInLoops: rows are applied in order — `seq` is handed out one per accepted row, and two rows for the same localId in one batch require the second lookup to observe the first row's upsert.
			const existing = await findExisting(ctx, userId, row);
			const candidate = {
				deletedAt: row.deletedAt,
				deviceId: args.deviceId,
				updatedAt: row.updatedAt,
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
				deviceId: args.deviceId,
				seq: nextSeq,
				userId,
			});
			nextSeq += 1;
			accepted += 1;
		}

		// One counter write per batch rather than per row.
		if (accepted > 0) {
			if (state) {
				await ctx.db.patch("syncState", state._id, { nextSeq });
			} else {
				await ctx.db.insert("syncState", { nextSeq, userId });
			}
		}

		return { accepted, nextSeq, skipped };
	},
	returns: v.object({
		accepted: v.number(),
		nextSeq: v.number(),
		skipped: v.number(),
	}),
});

function toWire(table: SyncedTable, doc: Doc<SyncedTable>) {
	const fieldNames = Object.keys(FIELDS_BY_TABLE[table] as Record<string, Validator<unknown>>);
	const source = doc as unknown as Record<string, unknown>;
	const fields: Record<string, unknown> = {};
	for (const name of fieldNames) {
		fields[name] = source[name] ?? null;
	}
	return {
		deletedAt: (source.deletedAt ?? null) as number | null,
		deviceId: doc.deviceId,
		fields,
		localId: (source.localId ?? source.key) as string,
		seq: doc.seq,
		table,
		updatedAt: doc.updatedAt,
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
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		const limit = Math.min(Math.max(Math.trunc(args.limit ?? PULL_PAGE_LIMIT), 1), PULL_PAGE_LIMIT);

		const pages = await Promise.all(
			SYNCED_TABLES.map((table: SyncedTable) =>
				ctx.db
					.query(table)
					.withIndex("by_user_and_seq", (q) => q.eq("userId", userId).gt("seq", args.cursor))
					.take(limit)
			)
		);

		const merged = pages
			.flatMap((docs, index) => docs.map((doc) => toWire(SYNCED_TABLES[index], doc)))
			.sort((a, b) => a.seq - b.seq);

		const rows = merged.slice(0, limit);
		const last = rows[rows.length - 1];

		return {
			cursor: last ? last.seq : args.cursor,
			// A full page may be exactly the tail, in which case the next call
			// serves nothing and the walk stops there — one wasted query, never a
			// missed row.
			hasMore: merged.length >= limit,
			rows,
		};
	},
	returns: v.object({
		cursor: v.number(),
		hasMore: v.boolean(),
		rows: v.array(pulledRow),
	}),
});

/**
 * The account's current watermark, subscribed to rather than polled: any
 * device's push moves it, which invalidates this query on every other device
 * and is what makes replication realtime without a poll loop.
 */
export const currentSeq = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const state = await ctx.db
			.query("syncState")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return state?.nextSeq ?? 0;
	},
	returns: v.number(),
});
