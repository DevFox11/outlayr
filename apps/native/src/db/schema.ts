import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Local-first mirror of the Swift Core Data model. `updatedAt` (wall-clock) and
 * `deletedAt` (soft-delete tombstone) are carried on every table so a future sync
 * layer can reconcile without a schema migration.
 */
export const categories = sqliteTable(
	"categories",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		color: text("color").default("#FFFFFF"),
		icon: text("icon"),
		emoji: text("emoji"),
		income: integer("income", { mode: "boolean" }).notNull().default(false),
		sortOrder: integer("sortOrder").notNull().default(0),
		dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
		parentId: text("parentId").references(
			(): AnySQLiteColumn => categories.id,
			{ onDelete: "set null" },
		),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("categories_income_idx").on(table.income),
		index("categories_parentId_idx").on(table.parentId),
		index("categories_deletedAt_idx").on(table.deletedAt),
	],
);

export const transactions = sqliteTable(
	"transactions",
	{
		id: text("id").primaryKey(),
		amount: real("amount").notNull(),
		income: integer("income", { mode: "boolean" }).notNull(),
		currency: text("currency"),
		note: text("note").notNull().default(""),
		details: text("details"),
		date: integer("date", { mode: "timestamp_ms" }).notNull(),
		day: integer("day", { mode: "timestamp_ms" }).notNull(),
		month: integer("month", { mode: "timestamp_ms" }).notNull(),
		icon: text("icon"),
		emoji: text("emoji"),
		customColor: text("customColor"),
		imageColor: text("imageColor"),
		imageUri: text("imageUri"),
		onceRecurring: integer("onceRecurring", { mode: "boolean" })
			.notNull()
			.default(false),
		recurringType: integer("recurringType").notNull().default(0),
		recurringCoefficient: integer("recurringCoefficient").notNull().default(1),
		recurringEndDate: integer("recurringEndDate", { mode: "timestamp_ms" }),
		categoryId: text("categoryId").references(() => categories.id, {
			onDelete: "cascade",
		}),
		/**
		 * `amount` canonicalized to USD at the rate of the day it happened, frozen
		 * at write. Read only to add figures in different currencies together — a
		 * same-currency read uses `amount` directly so it never round-trips.
		 *
		 * Null when it could not be computed (entry made offline before any rate was
		 * cached); aggregation falls back to face value there rather than dropping
		 * the row.
		 */
		amountUsd: real("amountUsd"),
		/** The USD→`currency` rate used, kept so the figure can be explained. */
		exchangeRate: real("exchangeRate"),
		/** Which market rate it came from: official | eur_reference | custom. */
		exchangeRateType: text("exchangeRateType"),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("transactions_day_idx").on(table.day),
		index("transactions_month_idx").on(table.month),
		index("transactions_categoryId_idx").on(table.categoryId),
		index("transactions_deletedAt_idx").on(table.deletedAt),
		// `date` carries almost every range predicate in the app (the log window,
		// budget periods, insight buckets). The composite serves the log's exact
		// sort, `orderBy(desc(day), desc(date))`, which otherwise cannot walk an
		// index.
		index("transactions_date_idx").on(table.date),
		index("transactions_day_date_idx").on(table.day, table.date),
	],
);

// `isNull(deletedAt)` is the universal read predicate on every soft-deleted
// table, and tombstones only accumulate, so each one carries its own index.
export const budgets = sqliteTable(
	"budgets",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		amount: real("amount").notNull(),
		type: integer("type").notNull(),
		startDate: integer("startDate", { mode: "timestamp_ms" }),
		dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
		/**
		 * The currency the target was set in, with its USD value frozen at that
		 * moment — the same contract `transactions` keeps.
		 */
		currency: text("currency"),
		amountUsd: real("amountUsd"),
		green: integer("green", { mode: "boolean" }).notNull().default(false),
		categoryId: text("categoryId")
			.references(() => categories.id, { onDelete: "cascade" })
			.unique(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [index("budgets_deletedAt_idx").on(table.deletedAt)],
);

export const mainBudget = sqliteTable(
	"mainBudget",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		amount: real("amount").notNull(),
		type: integer("type").notNull(),
		startDate: integer("startDate", { mode: "timestamp_ms" }),
		dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
		/**
		 * The currency the target was set in, with its USD value frozen at that
		 * moment — the same contract `transactions` keeps.
		 */
		currency: text("currency"),
		amountUsd: real("amountUsd"),
		green: integer("green", { mode: "boolean" }).notNull().default(false),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [index("mainBudget_deletedAt_idx").on(table.deletedAt)],
);

export const templateTransactions = sqliteTable(
	"templateTransactions",
	{
		id: text("id").primaryKey(),
		amount: real("amount").notNull(),
		income: integer("income", { mode: "boolean" }).notNull(),
		note: text("note"),
		sortOrder: integer("sortOrder").notNull().default(0),
		recurringType: integer("recurringType").notNull().default(0),
		recurringCoefficient: integer("recurringCoefficient").notNull().default(1),
		categoryId: text("categoryId").references(() => categories.id, {
			onDelete: "cascade",
		}),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [index("templateTransactions_deletedAt_idx").on(table.deletedAt)],
);

export const appMeta = sqliteTable("appMeta", {
	key: text("key").primaryKey(),
	value: text("value"),
});

/**
 * The durable push queue: one pending entry per replicated row, written by the
 * `AFTER INSERT/UPDATE` triggers the migration adds to the six user tables.
 * Triggers rather than repo calls because writes already happen outside the
 * repos (`data/recurrence-backfill.ts`, `data/canonicalize-backfill.ts`, the App
 * Intents drain in `lib/use-system-sync.ts`), and a repo-level queue would
 * silently miss the next such path.
 *
 * `(tableName, localId)` is unique, so a row edited a hundred times is queued
 * once: the queue is bounded by how many rows exist, not by how many writes
 * happened. The triggers are additionally gated on the device-local
 * `syncEnabled` flag, so a ledger that never syncs queues nothing at all.
 *
 * `seq` is AUTOINCREMENT, not a plain rowid, because re-queuing an already
 * pending row issues a *new* seq: a drain that pushes seqs 1-500 and then
 * deletes them cannot delete an edit that arrived while it was pushing. Plain
 * rowids are reused after the highest row is deleted, which reopens exactly
 * that window.
 *
 * drizzle-kit does not know triggers exist: it neither generates nor diffs them,
 * and the SQLite changes it implements by rebuilding a table drop every trigger
 * attached to it. A migration that recreates one of the six tables has to
 * re-declare its triggers by hand.
 */
export const outbox = sqliteTable(
	"outbox",
	{
		seq: integer("seq").primaryKey({ autoIncrement: true }),
		tableName: text("tableName").notNull(),
		localId: text("localId").notNull(),
		enqueuedAt: integer("enqueuedAt", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [uniqueIndex("outbox_row_idx").on(table.tableName, table.localId)],
);

/**
 * One-way replica of the Convex `exchangeRates` table — the only table here the
 * device never authors. Refreshed by wipe-and-replace (see `data/rates.ts`).
 *
 * The composite primary key mirrors the server's
 * `by_quote_and_rateType_and_date` uniqueness, which is what makes "the newest
 * row on or before this date" a deterministic lookup and lets the refresh
 * upsert cleanly.
 */
export const exchangeRates = sqliteTable(
	"exchangeRates",
	{
		quote: text("quote").notNull(),
		rateType: text("rateType").notNull(),
		/** UTC `YYYY-MM-DD`, matching the server so comparisons stay lexical. */
		date: text("date").notNull(),
		rate: real("rate").notNull(),
		source: text("source").notNull(),
		fetchedAt: integer("fetchedAt").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.quote, table.rateType, table.date] }),
	],
);
