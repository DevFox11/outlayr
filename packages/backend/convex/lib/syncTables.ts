import { v } from "convex/values";

/**
 * Everything a replicated column can hold once it is on the wire.
 *
 * Mirrors `WireValue` in `apps/native/src/data/sync-engine-core.ts`: the client
 * encodes every instant to epoch milliseconds before pushing, so no `Date` — and
 * nothing structured — ever reaches this side.
 */
export type WireValue = boolean | number | string | null;

/** A replicated row's payload, keyed by column name. */
export type WireFields = Record<string, WireValue>;

/**
 * The replication envelope and the per-table payloads, declared once so
 * `schema.ts` (what is stored) and `sync.ts` (what is accepted and served)
 * cannot drift. A column added to one and not the other would replicate as
 * silently missing data, which no test on either side alone would catch.
 */
export const replicated = {
    /** Soft-delete tombstone; rows are never removed from this table. */
    deletedAt: v.union(v.number(), v.null()),
    deviceId: v.string(),
    localId: v.string(),
    seq: v.number(),
    /** Client wall clock at the edit, mirroring the SQLite `updatedAt`. */
    updatedAt: v.number(),
    userId: v.string(),
};

export const categoryFields = {
    color: v.union(v.string(), v.null()),
    dateCreated: v.union(v.number(), v.null()),
    emoji: v.union(v.string(), v.null()),
    icon: v.union(v.string(), v.null()),
    income: v.boolean(),
    name: v.union(v.string(), v.null()),
    parentId: v.union(v.string(), v.null()),
    sortOrder: v.number(),
};

export const transactionFields = {
    accountId: v.union(v.string(), v.null()),
    amount: v.number(),
    amountUsd: v.union(v.number(), v.null()),
    categoryId: v.union(v.string(), v.null()),
    currency: v.union(v.string(), v.null()),
    customColor: v.union(v.string(), v.null()),
    date: v.number(),
    day: v.number(),
    details: v.union(v.string(), v.null()),
    emoji: v.union(v.string(), v.null()),
    exchangeRate: v.union(v.number(), v.null()),
    exchangeRateType: v.union(v.string(), v.null()),
    icon: v.union(v.string(), v.null()),
    imageColor: v.union(v.string(), v.null()),
    /**
     * The photo's R2 object key, or null. Not a url: `r2.getUrl` mints a signed
     * one with a 15-minute default lifetime, so a stored url is stale before the
     * next launch. The key is the stable half and every read re-mints from it.
     */
    imageKey: v.union(v.string(), v.null()),
    income: v.boolean(),
    month: v.number(),
    note: v.string(),
    onceRecurring: v.boolean(),
    /**
     * Optional, not just nullable: a handset still on the previous build pushes
     * rows without the key at all, and a required field would reject the whole
     * batch rather than the one column it cannot fill.
     */
    recurringAnchorDay: v.optional(v.union(v.number(), v.null())),
    recurringCoefficient: v.number(),
    recurringEndDate: v.union(v.number(), v.null()),
    recurringType: v.number(),
    /**
     * Optional for the same reason as `recurringAnchorDay`: a handset on the
     * previous build pushes rows without the key at all.
     */
    transferId: v.optional(v.union(v.string(), v.null())),
};

export const transferFields = {
    date: v.number(),
    dateCreated: v.number(),
    day: v.number(),
    exchangeRate: v.union(v.number(), v.null()),
    exchangeRateType: v.union(v.string(), v.null()),
    fromAccountId: v.string(),
    fromAmount: v.number(),
    fromAmountUsd: v.union(v.number(), v.null()),
    fromCurrency: v.string(),
    month: v.number(),
    note: v.string(),
    toAccountId: v.string(),
    toAmount: v.number(),
    toAmountUsd: v.union(v.number(), v.null()),
    toCurrency: v.string(),
};

/** `imageUri` is absent: it is a path into one device's container. */
export const accountFields = {
    currency: v.string(),
    customColor: v.union(v.string(), v.null()),
    dateCreated: v.number(),
    emoji: v.union(v.string(), v.null()),
    icon: v.union(v.string(), v.null()),
    imageColor: v.union(v.string(), v.null()),
    imageKey: v.union(v.string(), v.null()),
    initialBalance: v.number(),
    initialBalanceDate: v.number(),
    initialBalanceUsd: v.union(v.number(), v.null()),
    /**
     * Optional, not just nullable: a handset still on the previous build pushes
     * accounts without the key at all, and a required field would reject the
     * whole batch rather than the one column it cannot fill. Absent reads as
     * `asset` — see `domain/account-kind.ts`.
     */
    kind: v.optional(v.union(v.string(), v.null())),
    name: v.string(),
    sortOrder: v.number(),
};

/**
 * What the `transactions` table stores, which is the wire contract plus one
 * column no longer on it.
 *
 * `imageUri` is a device-local `file://` path whose container uuid changes on
 * every app update. Replicating it did active harm: the receiving device could
 * not resolve the path, its launch reconciliation cleared the column, and the
 * resulting push tie-broke on `deviceId` — so half the time the *originating*
 * device pulled back a null and lost the reference to a photo it still held.
 * It is kept here, optional, only so documents written before the fix validate;
 * nothing reads or serves it.
 */
export const transactionColumns = {
    ...transactionFields,
    // Optional in storage only: documents written before accounts existed have no
    // such field, and a required column would fail the schema push over them. The
    // wire keeps it required; `toWire` serves the absent field as null.
    accountId: v.optional(v.union(v.string(), v.null())),
    imageUri: v.optional(v.union(v.string(), v.null())),
};

export const budgetFields = {
    amount: v.number(),
    amountUsd: v.union(v.number(), v.null()),
    categoryId: v.union(v.string(), v.null()),
    currency: v.union(v.string(), v.null()),
    dateCreated: v.union(v.number(), v.null()),
    green: v.boolean(),
    name: v.union(v.string(), v.null()),
    rollover: v.boolean(),
    startDate: v.union(v.number(), v.null()),
    type: v.number(),
};

export const mainBudgetFields = {
    amount: v.number(),
    amountUsd: v.union(v.number(), v.null()),
    currency: v.union(v.string(), v.null()),
    dateCreated: v.union(v.number(), v.null()),
    green: v.boolean(),
    name: v.union(v.string(), v.null()),
    rollover: v.boolean(),
    startDate: v.union(v.number(), v.null()),
    type: v.number(),
};

export const savingsGoalFields = {
    accountId: v.string(),
    currency: v.string(),
    dateCreated: v.number(),
    /** The rate both frozen figures were valued at — see the local schema. */
    exchangeRate: v.optional(v.union(v.number(), v.null())),
    name: v.string(),
    sortOrder: v.number(),
    /**
     * The account's balance when the goal was set — see the local schema.
     *
     * Optional on the wire although the local column is NOT NULL: `pushRow` is
     * this mutation's ARGUMENT validator, so one row from a build that predates
     * these columns would reject the whole 500-row batch, unrelated tables and
     * all. The client always sends them; the server tolerates their absence.
     */
    startAmount: v.optional(v.number()),
    startAmountUsd: v.optional(v.union(v.number(), v.null())),
    targetAmount: v.number(),
    targetAmountUsd: v.union(v.number(), v.null()),
    /**
     * Still nullable on the wire for the same reason, even though a goal now
     * carries a date by definition. A dateless row that arrives is refused by
     * `isReplicated` on the way in rather than rejected on arrival.
     */
    targetDate: v.union(v.number(), v.null()),
};

export const appMetaFields = {
    value: v.union(v.string(), v.null()),
};

export const tagFields = {
    color: v.union(v.string(), v.null()),
    name: v.string(),
    sortOrder: v.number(),
};

/**
 * The join carries its own id: the replication envelope addresses rows by
 * `localId`, and a composite key has nothing for a tombstone to name.
 */
export const transactionTagFields = {
    tagId: v.string(),
    transactionId: v.string(),
};

/** `imageUri` is absent: it is a path into one device's container. */
export const transactionPhotoFields = {
    imageColor: v.union(v.string(), v.null()),
    imageKey: v.union(v.string(), v.null()),
    sortOrder: v.number(),
    transactionId: v.string(),
};

export const transactionSplitFields = {
    amount: v.number(),
    categoryId: v.union(v.string(), v.null()),
    sortOrder: v.number(),
    transactionId: v.string(),
};

export const TOMBSTONED_TABLES = [
    "categories",
    "transactions",
    "budgets",
    "mainBudget",
    "savingsGoals",
    "tags",
    "transactionTags",
    "transactionPhotos",
    "transactionSplits",
    "accounts",
    // After `accounts`: a transfer's two legs are account localIds.
    "transfers",
] as const;

/**
 * Pull order only. `appMeta` is last because it is the one table whose identity
 * is a key rather than a `localId`, so nothing else keys off its position.
 */
export const SYNCED_TABLES = [...TOMBSTONED_TABLES, "appMeta"] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const FIELDS_BY_TABLE = {
    accounts: accountFields,
    appMeta: appMetaFields,
    budgets: budgetFields,
    categories: categoryFields,
    mainBudget: mainBudgetFields,
    savingsGoals: savingsGoalFields,
    tags: tagFields,
    transactionPhotos: transactionPhotoFields,
    transactionSplits: transactionSplitFields,
    transactionTags: transactionTagFields,
    transactions: transactionFields,
    transfers: transferFields,
} as const;

interface Versioned {
    deletedAt: number | null;
    deviceId: string;
    updatedAt: number;
}

/**
 * R1 then R2 from `docs/convex-sync-design.md` §4, applied to a whole row.
 *
 * R1 — a tombstone is absorbing: whichever side is deleted wins outright, and
 * `updatedAt` never enters into it. The app has no undelete surface, so an edit
 * that loses to a delete cannot be observed as lost, whereas a resurrected
 * charge silently changes every total it is in.
 *
 * R2 — otherwise the greater `updatedAt` takes the whole row, and an exact tie
 * goes to the greater `deviceId`. Ties must break the same way here and on the
 * device (`apps/native/src/data/sync-merge.ts`) or the two never converge.
 *
 * A row identical on both sides does NOT win, which is what makes a re-push of
 * an unchanged row a no-op and the whole drain safe to retry.
 */
export function incomingWins(incoming: Versioned, existing: Versioned | null): boolean {
    if (existing === null) {
        return true;
    }
    const incomingDeleted = incoming.deletedAt !== null;
    const existingDeleted = existing.deletedAt !== null;
    if (incomingDeleted !== existingDeleted) {
        return incomingDeleted;
    }
    if (incoming.updatedAt !== existing.updatedAt) {
        return incoming.updatedAt > existing.updatedAt;
    }
    return incoming.deviceId > existing.deviceId;
}
