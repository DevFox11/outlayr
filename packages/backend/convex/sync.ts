import type { WithoutSystemFields } from "convex/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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
    savingsGoalFields,
    tagFields,
    transactionFields,
    transactionPhotoFields,
    transactionSplitFields,
    transactionTagFields,
    transferFields,
} from "./lib/syncTables";
import type { SyncedTable, WireFields, WireValue } from "./lib/syncTables";
import { requirePro } from "./revenuecat";

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
        table: v.literal("savingsGoals"),
        ...tombstone,
        fields: v.object(savingsGoalFields),
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
    fields: WireFields;
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

const TRANSACTION_VALUATION_FIELDS = new Set(["amountUsd", "exchangeRate", "exchangeRateType"]);
const TRANSACTION_LEGACY_OPTIONAL_NULLABLE_FIELDS = new Set<keyof typeof transactionFields>([
    "accountId",
    "recurringAnchorDay",
    "transferId",
    "feeForId",
    "feeRate",
]);

function transactionFieldsEqual(
    field: keyof typeof transactionFields,
    stored: WireValue | undefined,
    incoming: WireValue | undefined
): boolean {
    if (TRANSACTION_LEGACY_OPTIONAL_NULLABLE_FIELDS.has(field)) {
        return Object.is(stored ?? null, incoming ?? null);
    }
    return Object.is(stored, incoming);
}

function transactionPolicyTieDecision(row: PushRow, existing: Doc<SyncedTable> | null): "existing" | "incoming" | null {
    if (
        row.table !== "transactions" ||
        existing === null ||
        row.deletedAt !== null ||
        !("deletedAt" in existing) ||
        existing.deletedAt !== null ||
        row.updatedAt !== existing.updatedAt
    ) {
        return null;
    }
    // SAFETY: the guard above returned unless `row.table` is "transactions", and
    // `existing` was looked up by that same table name.
    const stored = existing as Doc<"transactions">;
    const incoming = fieldsFor<"transactions">(row);
    // SAFETY: `Object.keys` widens to string[]; the keys are this object's own.
    for (const field of Object.keys(transactionFields) as (keyof typeof transactionFields)[]) {
        if (
            !(TRANSACTION_VALUATION_FIELDS.has(field) || transactionFieldsEqual(field, stored[field], incoming[field]))
        ) {
            return null;
        }
    }
    const storedPendingCustom =
        stored.exchangeRateType === "custom" && stored.exchangeRate === null && stored.amountUsd === null;
    const incomingPendingCustom =
        incoming.exchangeRateType === "custom" && incoming.exchangeRate === null && incoming.amountUsd === null;
    if (storedPendingCustom === incomingPendingCustom) {
        return null;
    }
    const otherPolicy = storedPendingCustom ? incoming.exchangeRateType : stored.exchangeRateType;
    if (otherPolicy !== "official") {
        return null;
    }
    return incomingPendingCustom ? "incoming" : "existing";
}

/**
 * The already-validated payload for one table, recovered as its document type.
 *
 * `push`'s argument validator is the per-table union in `syncTables.ts`, so by
 * the time a row reaches `upsert` its `fields` have been checked against exactly
 * the columns `schema.ts` declares for `row.table`. The assertion only puts back
 * the generated type that a runtime table name erased — see the note on
 * `upsert`, and the switch below that pairs each literal with its own branch.
 */
function fieldsFor<T extends SyncedTable>(row: PushRow): Doc<T> {
    // SAFETY: the caller passes the table literal matching the case it is in.
    return row.fields as Doc<T>;
}

async function writeRow<T extends SyncedTable>(
    ctx: MutationCtx,
    table: T,
    existing: Doc<SyncedTable> | null,
    doc: WithoutSystemFields<Doc<T>>
): Promise<void> {
    // SAFETY: `existing` was looked up by `row.table`, which is the same `T`
    // this call was given, so its id addresses a row of that table.
    await (existing ? ctx.db.patch(table, existing._id as Id<T>, doc) : ctx.db.insert(table, doc));
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
        case "categories": {
            return await writeRow(ctx, "categories", existing, { ...envelope, ...fieldsFor<"categories">(row) });
        }
        case "transactions": {
            return await writeRow(ctx, "transactions", existing, {
                ...envelope,
                ...fieldsFor<"transactions">(row),
            });
        }
        case "budgets": {
            return await writeRow(ctx, "budgets", existing, { ...envelope, ...fieldsFor<"budgets">(row) });
        }
        case "mainBudget": {
            return await writeRow(ctx, "mainBudget", existing, { ...envelope, ...fieldsFor<"mainBudget">(row) });
        }
        case "tags": {
            return await writeRow(ctx, "tags", existing, { ...envelope, ...fieldsFor<"tags">(row) });
        }
        case "transactionTags": {
            return await writeRow(ctx, "transactionTags", existing, {
                ...envelope,
                ...fieldsFor<"transactionTags">(row),
            });
        }
        case "transactionPhotos": {
            return await writeRow(ctx, "transactionPhotos", existing, {
                ...envelope,
                ...fieldsFor<"transactionPhotos">(row),
            });
        }
        case "transactionSplits": {
            return await writeRow(ctx, "transactionSplits", existing, {
                ...envelope,
                ...fieldsFor<"transactionSplits">(row),
            });
        }
        case "accounts": {
            return await writeRow(ctx, "accounts", existing, { ...envelope, ...fieldsFor<"accounts">(row) });
        }
        case "transfers": {
            return await writeRow(ctx, "transfers", existing, { ...envelope, ...fieldsFor<"transfers">(row) });
        }
        case "savingsGoals": {
            const fields = fieldsFor<"savingsGoals">(row);
            // A client that predates `exchangeRate` omits it while sending a target
            // it valued at the EDIT date. Keeping the stored rate beside that pair
            // would leave the two describing different days, and every later
            // restatement would divide by a rate the target was never valued at.
            // Cleared instead, so readers fall back to the pair the editing client
            // actually used — which is the only consistent basis left.
            //
            // Only when that pair actually MOVED, though. The same client sends the
            // whole row to rename a goal or shift its deadline, and discarding a
            // precise rate over an edit that did not touch the target would give
            // away the precision this column exists to keep.
            // SAFETY: `existing` is the stored `savingsGoals` doc for this row when
            // there is one, and this branch is reached only for that table, so both
            // target fields are declared on it by `savingsGoalFields`.
            const priced = existing as { targetAmount?: number; targetAmountUsd?: number | null } | null;
            const targetMoved =
                priced == null ||
                priced.targetAmount !== fields.targetAmount ||
                priced.targetAmountUsd !== fields.targetAmountUsd;
            const rateless = !("exchangeRate" in row.fields) && fields.targetAmountUsd != null && targetMoved;
            return await writeRow(ctx, "savingsGoals", existing, {
                ...envelope,
                ...fields,
                ...(rateless && { exchangeRate: null }),
            });
        }
        case "appMeta": {
            const doc = {
                deviceId: stamp.deviceId,
                key: row.localId,
                seq: stamp.seq,
                updatedAt: row.updatedAt,
                userId: stamp.userId,
                // SAFETY: `appMeta` is the one table whose payload is a single
                // column, declared as exactly this in `syncTables.ts`.
                value: (row.fields as { value: string | null }).value,
            };
            // SAFETY: `existing` was looked up by `row.table`, which this case
            // has already matched against "appMeta".
            await (existing
                ? ctx.db.patch("appMeta", existing._id as Id<"appMeta">, doc)
                : ctx.db.insert("appMeta", doc));
            return;
        }
        default: {
            throw new ConvexError(`Unknown sync table: ${String(row.table)}`);
        }
    }
}

/**
 * Replication, both directions. Every function here derives `userId` from the
 * validated session and never from an argument, so one account can neither read
 * nor write another's ledger.
 *
 * Sync is a Pro entitlement, checked immediately after `requireUserId` in
 * `push` and `pullSince` — on the server, where a client cannot route around it.
 */
/**
 * Refuses a push from a device that has not learned the account is going.
 *
 * `purgeUserBatch` deletes `syncState` last and reports done, but the session is
 * not deleted until the end of `advance` and Pro is not cleared until
 * `recordBillingErased` — so both of this mutation's own guards stay true for a
 * window as long as a retried RevenueCat call. A push landing inside it
 * re-creates `syncState` at `nextSeq: 1` and re-inserts rows for a user id that
 * is about to stop existing, and nothing can ever find them again: every purge
 * path is keyed off the `accountDeletionJobs.userId` that `advance` then nulls.
 *
 * `prepared` is deliberately still allowed — the owner has asked but not
 * confirmed, and may yet cancel.
 */
export async function refuseWhileDeleting(ctx: QueryCtx, userId: string): Promise<void> {
    // Every job, not a page of them: this asks whether ANY job has moved past
    // `prepared`, and a page can only answer that if the newest job is inside
    // it. `accountDeletion.prepare` caps the set per user, which is what keeps
    // the full read small — without that cap a client could bury the one job
    // that refuses the push under a page of harmless prepared ones.
    const jobs = await ctx.db
        .query("accountDeletionJobs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    if (jobs.some((job) => job.phase !== "prepared")) {
        throw new ConvexError("This account is being deleted and can no longer accept changes");
    }
}

export async function seqCounter(ctx: MutationCtx, userId: string) {
    const state = await ctx.db
        .query("syncState")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    // Starts at 1 so that a cursor of 0 means "nothing read yet" rather than
    // "read everything up to the first row".
    const nextSeq = state?.nextSeq ?? 1;
    return {
        advanceTo: async (next: number) => {
            if (next <= nextSeq) {
                return;
            }
            await (state
                ? ctx.db.patch("syncState", state._id, { nextSeq: next })
                : ctx.db.insert("syncState", { nextSeq: next, userId }));
        },
        nextSeq,
    };
}

export const push = mutation({
    args: {
        deviceId: v.string(),
        rows: v.array(pushRow),
    },
    handler: async (ctx, args) => {
        const userId = await requireUserId(ctx);
        await requirePro(ctx, userId);
        await refuseWhileDeleting(ctx, userId);

        if (args.rows.length > PUSH_BATCH_LIMIT) {
            throw new ConvexError(`A push carries at most ${PUSH_BATCH_LIMIT} rows; got ${args.rows.length}`);
        }

        const counter = await seqCounter(ctx, userId);
        let { nextSeq } = counter;
        let accepted = 0;
        let skipped = 0;
        const reEmittedPolicyWinners = new Set<string>();

        /* oxlint-disable no-await-in-loop -- rows are applied in order — `seq` is handed out one per accepted row, and two rows for the same localId in one batch require the second lookup to observe the first row's upsert. */
        // SAFETY: `pushRow` above validates each row into exactly this shape;
        // `PushRow` is the flattened view of that union the loop reads.
        for (const row of args.rows as PushRow[]) {
            const existing = await findExisting(ctx, userId, row);
            const candidate = {
                deletedAt: row.deletedAt,
                deviceId: args.deviceId,
                updatedAt: row.updatedAt,
            };
            const policyTieDecision = transactionPolicyTieDecision(row, existing);
            if (policyTieDecision === "existing") {
                const key = `${row.table}:${row.localId}`;
                if (!reEmittedPolicyWinners.has(key)) {
                    // SAFETY: only a "transactions" row reaches a policy tie —
                    // `transactionPolicyTieDecision` returns null for every other
                    // table — and `existing` was looked up by that table name.
                    await ctx.db.patch("transactions", (existing as Doc<"transactions">)._id, { seq: nextSeq });
                    nextSeq += 1;
                    reEmittedPolicyWinners.add(key);
                }
                skipped += 1;
                continue;
            }
            if (policyTieDecision === null && !incomingWins(candidate, existing ? versioned(existing) : null)) {
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
        /* oxlint-enable no-await-in-loop */

        // One counter write per batch rather than per row.
        await counter.advanceTo(nextSeq);

        return { accepted, nextSeq, skipped };
    },
    returns: v.object({
        accepted: v.number(),
        nextSeq: v.number(),
        skipped: v.number(),
    }),
});

/**
 * A stored document read as the flat, per-column bag `toWire` walks.
 *
 * Every synced table's columns are declared in `syncTables.ts` as wire-shaped
 * validators, so a stored value is already a `WireValue`; `_id`/`_creationTime`
 * are Convex's own and are the reason the key type stays open.
 */
type StoredDocument = Record<string, WireValue | undefined> & {
    deletedAt?: number | null;
    /** `appMeta` identifies its rows by `key`; every other table by `localId`. */
    key?: string;
    localId?: string;
};

function toWire(table: SyncedTable, doc: Doc<SyncedTable>) {
    const fieldNames = Object.keys(FIELDS_BY_TABLE[table]);
    const source: StoredDocument = doc;
    const fields: WireFields = {};
    for (const name of fieldNames) {
        fields[name] = source[name] ?? null;
    }
    const localId = source.localId ?? source.key;
    if (localId === undefined) {
        // Every synced table declares one or the other in `syncTables.ts`, so
        // reaching here is schema drift, not bad data. Serving the row under a
        // stand-in id would have the client adopt it afresh on every pull.
        throw new Error(`Synced row in ${table} carries neither localId nor key`);
    }
    return {
        deletedAt: source.deletedAt ?? null,
        deviceId: doc.deviceId,
        fields,
        localId,
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
        await requirePro(ctx, userId);
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
