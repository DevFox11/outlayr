import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * Local-first mirror of the Swift Core Data model. `updatedAt` (wall-clock) and
 * `deletedAt` (soft-delete tombstone) are carried on every table so a future sync
 * layer can reconcile without a schema migration.
 */
export const categories = sqliteTable(
    "categories",
    {
        color: text("color").default("#FFFFFF"),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        emoji: text("emoji"),
        icon: text("icon"),
        id: text("id").primaryKey(),
        income: integer("income", { mode: "boolean" }).notNull().default(false),
        name: text("name"),
        parentId: text("parentId").references((): AnySQLiteColumn => categories.id, { onDelete: "set null" }),
        sortOrder: integer("sortOrder").notNull().default(0),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("categories_income_idx").on(table.income),
        index("categories_parentId_idx").on(table.parentId),
        index("categories_deletedAt_idx").on(table.deletedAt),
    ]
);

export const accounts = sqliteTable(
    "accounts",
    {
        currency: text("currency").notNull(),
        customColor: text("customColor"),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }).notNull(),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        emoji: text("emoji"),
        icon: text("icon"),
        id: text("id").primaryKey(),
        imageColor: text("imageColor"),
        imageKey: text("imageKey"),
        /** Device-local, like `transactions.imageUri`: never replicated. */
        imageUri: text("imageUri"),
        initialBalance: real("initialBalance").notNull().default(0),
        initialBalanceDate: integer("initialBalanceDate", {
            mode: "timestamp_ms",
        }).notNull(),
        /**
         * `initialBalance` canonicalized to USD at the rate of `initialBalanceDate`,
         * frozen at write — the same contract `transactions.amountUsd` keeps. Null
         * when no rate was available then.
         */
        initialBalanceUsd: real("initialBalanceUsd"),
        /** `asset` or `liability` — see `domain/account-kind.ts`. */
        kind: text("kind").notNull().default("asset"),
        name: text("name").notNull(),
        sortOrder: integer("sortOrder").notNull().default(0),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [index("accounts_deletedAt_idx").on(table.deletedAt)]
);

export const transfers = sqliteTable(
    "transfers",
    {
        date: integer("date", { mode: "timestamp_ms" }).notNull(),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }).notNull(),
        day: integer("day", { mode: "timestamp_ms" }).notNull(),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        exchangeRate: real("exchangeRate"),
        /** `EntryRateType` from `@outlayr/money/rates`: official | eur_reference | custom. */
        exchangeRateType: text("exchangeRateType"),
        fromAccountId: text("fromAccountId")
            .notNull()
            .references(() => accounts.id, { onDelete: "cascade" }),
        /**
         * The outbound leg — money that moved. A source-side fee is charged by its
         * own transaction and is NOT included here, or the source account would be
         * debited twice.
         */
        fromAmount: real("fromAmount").notNull(),
        fromAmountUsd: real("fromAmountUsd"),
        fromCurrency: text("fromCurrency").notNull(),
        id: text("id").primaryKey(),
        month: integer("month", { mode: "timestamp_ms" }).notNull(),
        note: text("note").notNull().default(""),
        toAccountId: text("toAccountId")
            .notNull()
            .references(() => accounts.id, { onDelete: "cascade" }),
        toAmount: real("toAmount").notNull(),
        toAmountUsd: real("toAmountUsd"),
        toCurrency: text("toCurrency").notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("transfers_day_idx").on(table.day),
        index("transfers_fromAccountId_idx").on(table.fromAccountId),
        index("transfers_toAccountId_idx").on(table.toAccountId),
        index("transfers_deletedAt_idx").on(table.deletedAt),
        index("transfers_day_date_idx").on(table.day, table.date),
    ]
);

export const transactions = sqliteTable(
    "transactions",
    {
        /**
         * ⚠️ This `onDelete` is NOT in the live DDL. The column arrived by
         * `ALTER TABLE ... ADD COLUMN` (migration 0015), and SQLite cannot carry an
         * `ON DELETE` clause on an added column — the shipped schema reads
         * `\`accountId\` text REFERENCES accounts(id)`, i.e. NO ACTION. Nothing
         * hard-deletes an account (rows are tombstoned), so it is latent; but with
         * `foreign_keys = ON`, which `client.ts` sets on a clean store, a hard
         * delete would be REFUSED rather than nulling this column.
         */
        accountId: text("accountId").references(() => accounts.id, {
            onDelete: "set null",
        }),
        amount: real("amount").notNull(),
        /**
         * `amount` canonicalized to USD at the rate of the day it happened, frozen
         * at write. Read only to add figures in different currencies together — a
         * same-currency read uses `amount` directly so it never round-trips.
         *
         * A resolved row freezes this together with `exchangeRate` and
         * `exchangeRateType`. The intentional custom-pending triple is
         * `(null, null, "custom")`: the native amount remains usable while
         * cross-currency aggregation waits for confirmation.
         */
        amountUsd: real("amountUsd"),
        categoryId: text("categoryId").references(() => categories.id, {
            onDelete: "cascade",
        }),
        currency: text("currency"),
        customColor: text("customColor"),
        date: integer("date", { mode: "timestamp_ms" }).notNull(),
        day: integer("day", { mode: "timestamp_ms" }).notNull(),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        details: text("details"),
        emoji: text("emoji"),
        /** The frozen currency-per-USD actual rate, or null while custom is pending. */
        exchangeRate: real("exchangeRate"),
        /** Which market rate it came from: official | eur_reference | custom. */
        exchangeRateType: text("exchangeRateType"),
        icon: text("icon"),
        id: text("id").primaryKey(),
        imageColor: text("imageColor"),
        /**
         * The photo's R2 object key, which is what replicates. Null means the bytes
         * are not in the account yet; a key with no `imageUri` means they are, but
         * this device has not fetched them.
         */
        imageKey: text("imageKey"),
        /**
         * Where the photo lives on THIS device. Never replicated: the path embeds a
         * container uuid that changes on every app update, so it is meaningless on
         * another handset and stale on this one after an update.
         */
        imageUri: text("imageUri"),
        income: integer("income", { mode: "boolean" }).notNull(),
        month: integer("month", { mode: "timestamp_ms" }).notNull(),
        note: text("note").notNull().default(""),
        onceRecurring: integer("onceRecurring", { mode: "boolean" }).notNull().default(false),
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
        recurringCoefficient: integer("recurringCoefficient").notNull().default(1),
        recurringEndDate: integer("recurringEndDate", { mode: "timestamp_ms" }),
        recurringType: integer("recurringType").notNull().default(0),
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
        /**
         * Set only on a transfer's fee. A lifecycle link, never an exclusion flag:
         * a fee is ordinary spending and every aggregate must keep counting it, so
         * nothing filters on this column.
         */
        /**
         * ⚠️ Same as `accountId` above: added by `ALTER TABLE` (migration 0018), so
         * the live DDL is a bare `REFERENCES transfers(id)` and this cascade does
         * not exist in the database. Deleting a transfer does NOT delete its legs
         * here — `transfersRepo` tombstones both sides itself, which is what
         * actually keeps them together.
         */
        transferId: text("transferId").references(() => transfers.id, {
            onDelete: "cascade",
        }),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("transactions_transferId_idx").on(table.transferId),
        index("transactions_day_idx").on(table.day),
        index("transactions_month_idx").on(table.month),
        index("transactions_categoryId_idx").on(table.categoryId),
        index("transactions_accountId_idx").on(table.accountId),
        index("transactions_deletedAt_idx").on(table.deletedAt),
        // Partial, because every live row shares the NULL `deletedAt` key and
        // `transactions_deletedAt_idx` therefore cannot narrow this at all.
        // Three readers ask it: the subscription-reminder sweep at every launch,
        // the recurrence back-fill, and a `useLiveQuery` in `log-filtered` that
        // re-runs on every write to this table. Measured at 20k rows, 200 runs:
        // `SCAN transactions` 113ms, `SEARCH ... USING INDEX` 5ms.
        index("transactions_recurring_idx")
            .on(table.recurringType)
            .where(sql`${table.deletedAt} IS NULL AND ${table.recurringType} > 0`),
        // `date` carries almost every range predicate in the app (the log window,
        // budget periods, insight buckets). The composite serves the log's exact
        // sort, `orderBy(desc(day), desc(date))`, which otherwise cannot walk an
        // index.
        index("transactions_date_idx").on(table.date),
        index("transactions_day_date_idx").on(table.day, table.date),
    ]
);

// `isNull(deletedAt)` is the universal read predicate on every soft-deleted
// table, and tombstones only accumulate, so each one carries its own index.
export const budgets = sqliteTable(
    "budgets",
    {
        amount: real("amount").notNull(),
        amountUsd: real("amountUsd"),
        categoryId: text("categoryId")
            .references(() => categories.id, { onDelete: "cascade" })
            .unique(),
        /**
         * The currency the target was set in, with its USD value frozen at that
         * moment — the same contract `transactions` keeps.
         */
        currency: text("currency"),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        green: integer("green", { mode: "boolean" }).notNull().default(false),
        id: text("id").primaryKey(),
        name: text("name"),
        /**
         * Whether an unspent (or overspent) window carries into the next one.
         * Off by default, so an existing budget keeps meaning exactly what it did.
         */
        rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
        startDate: integer("startDate", { mode: "timestamp_ms" }),
        type: integer("type").notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [index("budgets_deletedAt_idx").on(table.deletedAt)]
);

export const mainBudget = sqliteTable(
    "mainBudget",
    {
        amount: real("amount").notNull(),
        amountUsd: real("amountUsd"),
        /**
         * The currency the target was set in, with its USD value frozen at that
         * moment — the same contract `transactions` keeps.
         */
        currency: text("currency"),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        green: integer("green", { mode: "boolean" }).notNull().default(false),
        id: text("id").primaryKey(),
        name: text("name"),
        /**
         * Whether an unspent (or overspent) window carries into the next one.
         * Off by default, so an existing budget keeps meaning exactly what it did.
         */
        rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
        startDate: integer("startDate", { mode: "timestamp_ms" }),
        type: integer("type").notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [index("mainBudget_deletedAt_idx").on(table.deletedAt)]
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
        /** Unsigned, like the entry's own amount: direction comes from `income`. */
        amount: real("amount").notNull(),
        categoryId: text("categoryId").references(() => categories.id),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        id: text("id").primaryKey(),
        sortOrder: integer("sortOrder").notNull().default(0),
        transactionId: text("transactionId")
            .notNull()
            .references(() => transactions.id),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("transactionSplits_transactionId_idx").on(table.transactionId),
        index("transactionSplits_categoryId_idx").on(table.categoryId),
        index("transactionSplits_deletedAt_idx").on(table.deletedAt),
    ]
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
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        id: text("id").primaryKey(),
        /** The glow derived from the bytes, kept per photo rather than per entry. */
        imageColor: text("imageColor"),
        imageKey: text("imageKey"),
        imageUri: text("imageUri"),
        sortOrder: integer("sortOrder").notNull().default(0),
        transactionId: text("transactionId")
            .notNull()
            .references(() => transactions.id),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("transactionPhotos_transactionId_idx").on(table.transactionId),
        index("transactionPhotos_deletedAt_idx").on(table.deletedAt),
    ]
);

/**
 * A label that crosses categories. The hierarchy answers "what kind of expense"
 * once per row; a tag answers "which of my concerns does this touch", and a
 * dinner can be both `work` and `travel` while still being one Food entry.
 */
/**
 * A target on an account. Progress is that account's balance, so there is no
 * parallel record of the same money to drift — see `domain/savings-goal.ts`.
 */
export const savingsGoals = sqliteTable(
    "savingsGoals",
    {
        accountId: text("accountId")
            .notNull()
            .references(() => accounts.id, { onDelete: "cascade" }),
        currency: text("currency").notNull(),
        dateCreated: integer("dateCreated", { mode: "timestamp_ms" }).notNull(),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        /**
         * The rate both frozen figures were valued at, currency PER USD.
         *
         * Stored rather than re-derived because neither basis survives: the rate
         * history is pruned to one row per month outside the 90-day window, so a
         * later lookup can land on a different day's rate, and dividing the stored
         * amount pair recovers only as much precision as those rounded amounts
         * kept. Null for a goal already in USD, and for one written before this
         * column existed.
         */
        exchangeRate: real("exchangeRate"),
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        sortOrder: integer("sortOrder").notNull().default(0),
        /**
         * The account's balance when the goal was set, frozen at that write.
         *
         * Derived history would answer this for a recent goal and not for an old
         * one — `accountBalanceSeries` only walks the last 182 days — and the
         * anchor is what makes "ahead of the date" measurable for the whole life
         * of the goal. Frozen for the same reason every other figure here is.
         */
        startAmount: real("startAmount").notNull().default(0),
        startAmountUsd: real("startAmountUsd"),
        targetAmount: real("targetAmount").notNull(),
        /** Frozen at write, like every other cross-currency figure in the ledger. */
        targetAmountUsd: real("targetAmountUsd"),
        /** Required: a target with no deadline has no pace, and the pace is the point. */
        targetDate: integer("targetDate", { mode: "timestamp_ms" }).notNull(),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("savingsGoals_accountId_idx").on(table.accountId),
        index("savingsGoals_deletedAt_idx").on(table.deletedAt),
    ]
);

export const tags = sqliteTable(
    "tags",
    {
        color: text("color"),
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        sortOrder: integer("sortOrder").notNull().default(0),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [index("tags_deletedAt_idx").on(table.deletedAt)]
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
        deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
        id: text("id").primaryKey(),
        tagId: text("tagId")
            .notNull()
            .references(() => tags.id),
        transactionId: text("transactionId")
            .notNull()
            .references(() => transactions.id),
        updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [
        index("transactionTags_transactionId_idx").on(table.transactionId),
        index("transactionTags_tagId_idx").on(table.tagId),
        index("transactionTags_deletedAt_idx").on(table.deletedAt),
        uniqueIndex("transactionTags_pair_idx").on(table.transactionId, table.tagId),
    ]
);

export const appMeta = sqliteTable("appMeta", {
    key: text("key").primaryKey(),
    value: text("value"),
});

/**
 * The durable push queue: one pending entry per replicated row, written by the
 * `AFTER INSERT/UPDATE` triggers the migrations add to every replicated table.
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
 * attached to it. A migration that recreates one of the replicated tables has to
 * re-declare its triggers by hand.
 */
export const outbox = sqliteTable(
    "outbox",
    {
        enqueuedAt: integer("enqueuedAt", { mode: "timestamp_ms" }).notNull(),
        localId: text("localId").notNull(),
        seq: integer("seq").primaryKey({ autoIncrement: true }),
        tableName: text("tableName").notNull(),
    },
    (table) => [uniqueIndex("outbox_row_idx").on(table.tableName, table.localId)]
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
        /** UTC `YYYY-MM-DD`, matching the server so comparisons stay lexical. */
        date: text("date").notNull(),
        fetchedAt: integer("fetchedAt").notNull(),
        quote: text("quote").notNull(),
        rate: real("rate").notNull(),
        rateType: text("rateType").notNull(),
        source: text("source").notNull(),
    },
    (table) => [primaryKey({ columns: [table.quote, table.rateType, table.date] })]
);
