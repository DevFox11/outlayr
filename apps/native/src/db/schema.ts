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

export const accounts = sqliteTable(
	"accounts",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		currency: text("currency").notNull(),
		initialBalance: real("initialBalance").notNull().default(0),
		/**
		 * `initialBalance` canonicalized to USD at the rate of `initialBalanceDate`,
		 * frozen at write — the same contract `transactions.amountUsd` keeps. Null
		 * when no rate was available then.
		 */
		initialBalanceUsd: real("initialBalanceUsd"),
		initialBalanceDate: integer("initialBalanceDate", {
			mode: "timestamp_ms",
		}).notNull(),
		icon: text("icon"),
		emoji: text("emoji"),
		customColor: text("customColor"),
		imageColor: text("imageColor"),
		/** Device-local, like `transactions.imageUri`: never replicated. */
		imageUri: text("imageUri"),
		imageKey: text("imageKey"),
		sortOrder: integer("sortOrder").notNull().default(0),
		dateCreated: integer("dateCreated", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [index("accounts_deletedAt_idx").on(table.deletedAt)],
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
		/**
		 * Where the photo lives on THIS device. Never replicated: the path embeds a
		 * container uuid that changes on every app update, so it is meaningless on
		 * another handset and stale on this one after an update.
		 */
		imageUri: text("imageUri"),
		/**
		 * The photo's R2 object key, which is what replicates. Null means the bytes
		 * are not in the account yet; a key with no `imageUri` means they are, but
		 * this device has not fetched them.
		 */
		imageKey: text("imageKey"),
		onceRecurring: integer("onceRecurring", { mode: "boolean" })
			.notNull()
			.default(false),
		recurringType: integer("recurringType").notNull().default(0),
		recurringCoefficient: integer("recurringCoefficient").notNull().default(1),
		recurringEndDate: integer("recurringEndDate", { mode: "timestamp_ms" }),
		/**
		 * The day of the month the schedule was written for, which a short month
		 * can pull an individual occurrence off. Without it the clamp is lossy:
		 * February drags a 31st schedule to the 28th and the carrier's own `date`
		 * is then the only anchor left, so March lands on the 28th too and the
		 * 31st never comes back.
		 *
		 * Replicated, unlike `reminderLeadDays` — two devices sweeping the same
		 * chain must derive the same occurrence days, or `occurrenceId` differs
		 * and the ledger doubles the subscription.
		 *
		 * Null on a row from before this column existed, and on every retired row.
		 * Readers fall back to the row's own day-of-month, which is what the walk
		 * did before.
		 */
		recurringAnchorDay: integer("recurringAnchorDay"),
		/**
		 * Days of notice for the next charge's reminder. Null is "no reminder" and
		 * has to stay distinct from 0, which is "on the day itself".
		 *
		 * A chain holds the value on whichever row currently carries
		 * `recurringType > 0`. Every path that retires a row clears it, the pull
		 * applier included, so a notice can never outlive its schedule — but a
		 * reader must still key off `recurringType > 0` and a null `deletedAt`
		 * rather than off this column alone.
		 *
		 * Device-local, like `imageUri`: each handset schedules its own local
		 * notification, so replicating the preference would buy nothing. The cost is
		 * that a hand-off performed by a *peer* — its sweep retires the carrier and
		 * inserts the successor — drops the notice instead of moving it, since the
		 * successor arrives here with the column unset.
		 */
		reminderLeadDays: integer("reminderLeadDays"),
		categoryId: text("categoryId").references(() => categories.id, {
			onDelete: "cascade",
		}),
		accountId: text("accountId").references(() => accounts.id, {
			onDelete: "set null",
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
		index("transactions_accountId_idx").on(table.accountId),
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
		/**
		 * Whether an unspent (or overspent) window carries into the next one.
		 * Off by default, so an existing budget keeps meaning exactly what it did.
		 */
		rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
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
		/**
		 * Whether an unspent (or overspent) window carries into the next one.
		 * Off by default, so an existing budget keeps meaning exactly what it did.
		 */
		rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
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

/**
 * One entry's amount attributed to one category.
 *
 * An entry with NO rows here is not unattributed — it is attributed wholly to
 * its own `categoryId`, which is what keeps every existing row and every reader
 * that never learns about splitting correct without being touched. See
 * `domain/split.ts`, which is where that rule lives.
 *
 * The parts must sum to the entry's amount. Nothing in SQLite can enforce that,
 * so the write path is the only guard and `isBalanced` is what it asks.
 */
export const transactionSplits = sqliteTable(
	"transactionSplits",
	{
		id: text("id").primaryKey(),
		transactionId: text("transactionId")
			.notNull()
			.references(() => transactions.id),
		categoryId: text("categoryId").references(() => categories.id),
		/** Unsigned, like the entry's own amount: direction comes from `income`. */
		amount: real("amount").notNull(),
		sortOrder: integer("sortOrder").notNull().default(0),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("transactionSplits_transactionId_idx").on(table.transactionId),
		index("transactionSplits_categoryId_idx").on(table.categoryId),
		index("transactionSplits_deletedAt_idx").on(table.deletedAt),
	],
);

/**
 * A photo attached to an entry.
 *
 * Supersedes the single `transactions.imageUri`/`imageKey` pair, which stays for
 * the migration to read and for a build that has not run it yet. `sortOrder`
 * decides which one represents the entry in a list, so a row still has one face.
 *
 * `imageUri` is device-local for the same reason it is on `transactions`: the
 * path embeds a container uuid that changes on every app update, so it is
 * meaningless on another handset and stale on this one after an update.
 */
export const transactionPhotos = sqliteTable(
	"transactionPhotos",
	{
		id: text("id").primaryKey(),
		transactionId: text("transactionId")
			.notNull()
			.references(() => transactions.id),
		imageUri: text("imageUri"),
		imageKey: text("imageKey"),
		/** The glow derived from the bytes, kept per photo rather than per entry. */
		imageColor: text("imageColor"),
		sortOrder: integer("sortOrder").notNull().default(0),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("transactionPhotos_transactionId_idx").on(table.transactionId),
		index("transactionPhotos_deletedAt_idx").on(table.deletedAt),
	],
);

/**
 * A label that crosses categories. The hierarchy answers "what kind of expense"
 * once per row; a tag answers "which of my concerns does this touch", and a
 * dinner can be both `work` and `travel` while still being one Food entry.
 */
export const tags = sqliteTable(
	"tags",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		color: text("color"),
		sortOrder: integer("sortOrder").notNull().default(0),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [index("tags_deletedAt_idx").on(table.deletedAt)],
);

/**
 * The join. It carries its own `id` rather than keying on the pair because that
 * is what the replication envelope addresses rows by — a composite key has no
 * `localId` to travel under, and a tombstone needs something to name.
 *
 * `onDelete: "cascade"` is deliberately NOT set on either side: rows are
 * tombstoned rather than dropped here, so a cascade would fire only on a hard
 * delete that never happens, while hiding that the link needs tombstoning too.
 */
export const transactionTags = sqliteTable(
	"transactionTags",
	{
		id: text("id").primaryKey(),
		transactionId: text("transactionId")
			.notNull()
			.references(() => transactions.id),
		tagId: text("tagId")
			.notNull()
			.references(() => tags.id),
		updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
		deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("transactionTags_transactionId_idx").on(table.transactionId),
		index("transactionTags_tagId_idx").on(table.tagId),
		index("transactionTags_deletedAt_idx").on(table.deletedAt),
		uniqueIndex("transactionTags_pair_idx").on(
			table.transactionId,
			table.tagId,
		),
	],
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
