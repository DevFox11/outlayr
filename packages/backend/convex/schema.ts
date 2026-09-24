import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { marketRateType, rateSource } from "./lib/currencies";
import {
    accountFields,
    appMetaFields,
    budgetFields,
    categoryFields,
    mainBudgetFields,
    replicated,
    savingsGoalFields,
    tagFields,
    transactionColumns,
    transactionPhotoFields,
    transactionSplitFields,
    transactionTagFields,
    transferFields,
} from "./lib/syncTables";

/**
 * Every replicated row carries the `replicated` envelope from `lib/syncTables`,
 * which is also what `sync.ts` accepts and serves. See
 * `docs/convex-sync-design.md`.
 *
 * `localId` is the device-generated UUIDv4 that is already the SQLite primary
 * key (`apps/native/src/domain/ids.ts`); it — not the Convex `_id` — is the
 * cross-device identity of a row, because the device authored it before it had
 * ever spoken to the server.
 *
 * `seq` is a per-user monotonic counter assigned by the push mutation from
 * `syncState.nextSeq`. Convex has no server-side "last modified" ordering
 * (`_creationTime` does not move on patch) and a client wall clock cannot order
 * two devices, so the pull cursor is this integer and nothing else.
 *
 * `deviceId` breaks last-writer-wins ties deterministically when two devices
 * stamp the same `updatedAt` millisecond.
 */

/**
 * Every replicated table carries `by_user_and_seq`, the pull cursor — a fresh
 * device walks it from 0 and an established one from its watermark — and
 * `by_user_and_localId`, the push upsert lookup. Almost nothing else is indexed
 * because almost nothing else queries these tables: every read the app performs
 * on this data runs against the local SQLite replica, not here.
 *
 * The exception is `by_user_and_imageKey`, on the three tables that carry an
 * `imageKey`. `photos.releaseUnreferenced` has to ask the server whether any row
 * still names an object before it frees the bytes, and that question cannot be
 * answered on the device.
 */
export const enrichmentResult = v.object({
    categoryName: v.union(v.string(), v.null()),
    domain: v.union(v.string(), v.null()),
    emoji: v.union(v.string(), v.null()),
    isNewCategory: v.boolean(),
    merchantName: v.union(v.string(), v.null()),
    parentCategoryName: v.union(v.string(), v.null()),
    tags: v.array(v.string()),
});

export default defineSchema({
    accountDeletionJobs: defineTable({
        errorCode: v.union(v.string(), v.null()),
        expiresAt: v.number(),
        googleReceiptChallengeHash: v.union(v.string(), v.null()),
        googleReceiptDigest: v.union(v.string(), v.null()),
        phase: v.union(
            v.literal("prepared"),
            v.literal("providersRevoked"),
            v.literal("purged"),
            v.literal("billingErased"),
            v.literal("authDeleting"),
            v.literal("complete")
        ),
        provider: v.union(v.literal("appleServerRevoked"), v.literal("googleLocalReceipt"), v.null()),
        secretHash: v.string(),
        tokenIdentifier: v.optional(v.string()),
        userId: v.union(v.string(), v.null()),
    })
        .index("by_secretHash", ["secretHash"])
        .index("by_phase_and_expiresAt", ["phase", "expiresAt"])
        .index("by_userId", ["userId"]),

    /**
     * `transactions.accountId` holds an account's `localId`, staying in local-id
     * space like every other foreign key the envelope carries.
     */
    accounts: defineTable({ ...replicated, ...accountFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"])
        .index("by_user_and_imageKey", ["userId", "imageKey"]),

    /**
     * The syncable slice of the local `appMeta` key/value store. `key` stands in
     * for `localId` — the key *is* the row identity, so a second device editing
     * "currency" is editing the same row by construction. Keys are never deleted,
     * hence no tombstone.
     *
     * Only the account-scoped keys belong here. Everything the Settings screen
     * files under "This device" (`apps/native/src/screens/settings/index.tsx:161`)
     * — haptics, biometric lock, notifications — plus `firstLaunch` stay local by
     * design, not by omission.
     */
    appMeta: defineTable({
        deviceId: v.string(),
        key: v.string(),
        seq: v.number(),
        updatedAt: v.number(),
        userId: v.string(),
        ...appMetaFields,
    })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_key", ["userId", "key"]),

    /**
     * SQLite declares `categoryId` unique; Convex has no unique constraint and
     * this table deliberately does not fake one. Two offline devices can each
     * create a budget for the same category, and the merge that reconciles them
     * runs on the client — see "Two rows that must be one" in the design doc.
     */
    budgets: defineTable({ ...replicated, ...budgetFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /**
     * `parentId` holds another category's `localId`, not a Convex `Id`. The whole
     * point of the envelope is that a row's identity survives a device that has
     * never synced, so foreign keys stay in local-id space on both sides.
     */
    categories: defineTable({ ...replicated, ...categoryFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /**
     * The grounded-lookup invoice. No key, no user, no merchant name — only what
     * was spent and whether it published, so `groundedSpend.monthlyTotal` (the
     * only reader, internal-only) can tighten the env-configured unit prices
     * from observed data without ever exposing a per-merchant spend trail.
     */
    enrichmentJobs: defineTable({
        categoryTree: v.array(v.object({ children: v.array(v.string()), name: v.string() })),
        currency: v.optional(v.string()),
        grounded: v.boolean(),
        income: v.boolean(),
        localId: v.string(),
        locale: v.optional(v.string()),
        name: v.string(),
        regionCode: v.optional(v.string()),
        result: v.optional(enrichmentResult),
        status: v.union(v.literal("queued"), v.literal("done"), v.literal("failed")),
        userId: v.string(),
    })
        .index("by_user_and_localId", ["userId", "localId"])
        .index("by_user_and_status", ["userId", "status"]),

    /**
     * Market exchange rates, quoted per USD. Written only by the fetcher crons and
     * bounded by `pruneStale`.
     *
     * `date` is a UTC `YYYY-MM-DD` string rather than an epoch so the composite
     * index reads as a calendar: a descending seek on `by_quote_and_rateType_and_date`
     * answers "the newest row on or before this day", which is what covers the
     * weekend and holiday gaps in the provider feed.
     */
    exchangeRates: defineTable({
        date: v.string(),
        fetchedAt: v.number(),
        quote: v.string(),
        rate: v.number(),
        rateType: marketRateType,
        source: rateSource,
    })
        .index("by_quote_and_rateType_and_date", ["quote", "rateType", "date"])
        .index("by_date", ["date"]),

    groundedSpend: defineTable({
        actualMicros: v.number(),
        at: v.number(),
        chargedMicros: v.number(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        published: v.boolean(),
        searchCalls: v.number(),
    }).index("by_at", ["at"]),

    /** Singleton by convention only, for the same reason `budgets` is. */
    mainBudget: defineTable({ ...replicated, ...mainBudgetFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /**
     * Globally shared, no `userId` by construction — same shape as
     * `exchangeRates` and `photoObjects` above. Exactly one index and exactly
     * one exact-key reader (`merchantKnowledge.lookup`, internal-only): a
     * prefix or range index here would be an enumeration surface over a
     * shared table (see the merchantKnowledge module's own doc comment).
     */
    merchantKnowledge: defineTable({
        categoryName: v.string(),
        domain: v.string(),
        emoji: v.union(v.string(), v.null()),
        expiresAt: v.optional(v.number()),
        key: v.string(),
        merchantName: v.optional(v.string()),
        modelId: v.string(),
        parentCategoryName: v.union(v.string(), v.null()),
        resolvedAt: v.number(),
        source: v.optional(v.union(v.literal("model"), v.literal("web"))),
        tags: v.array(v.string()),
    }).index("by_key", ["key"]),

    /**
     * Where Convex file storage put a photo, keyed by the same derived key R2
     * would have used as the address itself.
     *
     * Only written when the deployment has no R2 credentials. It exists because
     * Convex storage allocates its own id, so the key cannot address the bytes
     * on its own — R2 needs no equivalent. Reads route per key rather than per
     * deployment, so photos stored before R2 was switched on keep resolving.
     *
     * No `userId`: the key already carries the owner, and `ownsPhotoKey` checks
     * it before this table is ever consulted.
     */
    photoObjects: defineTable({
        key: v.string(),
        storageId: v.id("_storage"),
    })
        .index("by_key", ["key"])
        .index("by_storageId", ["storageId"]),

    /**
     * What each stored object weighs, so an account's total is one indexed read
     * rather than a walk of the bucket.
     *
     * The obvious alternative does not exist: `r2.listMetadata` takes a limit and
     * a cursor and no prefix, so it cannot be scoped to an account at all — it
     * paginates every object every user has. Sizes are known exactly once, when
     * an upload is confirmed, so they are recorded there and summed here.
     *
     * Keyed by object rather than accumulated into a single per-account counter
     * because re-uploading a name replaces the object: a counter would add the
     * new size to the old one, while a row is simply overwritten by its own
     * replacement.
     */
    photoSizes: defineTable({
        bytes: v.number(),
        key: v.string(),
        userId: v.string(),
    })
        .index("by_user", ["userId"])
        .index("by_user_and_bytes", ["userId", "bytes"])
        .index("by_key", ["key"]),

    /** A target on an account; progress is that account's balance. */
    savingsGoals: defineTable({ ...replicated, ...savingsGoalFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /**
     * One document per user, holding the counter that stamps `seq`. Bumped once
     * per push batch rather than once per row, so a three-device household is
     * nowhere near the write contention that would make a single hot document a
     * problem.
     */
    syncState: defineTable({
        nextSeq: v.number(),
        userId: v.string(),
    }).index("by_user", ["userId"]),

    /**
     * A label that crosses categories, and the join that attaches it. The join
     * carries its own `localId` rather than keying on the pair, because that is
     * what the envelope addresses rows by and what a tombstone has to name.
     */
    tags: defineTable({ ...replicated, ...tagFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /** A photo attached to an entry. The bytes travel out of band, as ever. */
    transactionPhotos: defineTable({ ...replicated, ...transactionPhotoFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"])
        .index("by_user_and_imageKey", ["userId", "imageKey"]),

    /**
     * One entry's amount attributed to one category. No rows means the entry is
     * attributed wholly to its own `categoryId` — see `domain/split.ts`.
     */
    transactionSplits: defineTable({ ...replicated, ...transactionSplitFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    transactionTags: defineTable({ ...replicated, ...transactionTagFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),

    /**
     * `amount` is a float in the ledger's own currency, matching SQLite `REAL` —
     * both sides are IEEE-754 float64, so the value round-trips bit-for-bit and
     * sync neither introduces nor repairs the float-dollar rounding the local
     * schema already lives with.
     *
     * `amountUsd` / `exchangeRate` / `exchangeRateType` are frozen at write and
     * only ever move together with `amount`, `currency` and `date`. They are
     * replicated verbatim; nothing here recomputes them.
     *
     * `imageKey` names the photo's bytes in R2; the bytes themselves travel out
     * of band (`photos.ts`) because a `push` batch is small records, not blobs.
     */
    transactions: defineTable({ ...replicated, ...transactionColumns })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"])
        .index("by_user_and_imageKey", ["userId", "imageKey"]),

    /**
     * `fromAccountId` and `toAccountId` hold account `localId`s, staying in
     * local-id space like every other foreign key the envelope carries.
     */
    transfers: defineTable({ ...replicated, ...transferFields })
        .index("by_user_and_seq", ["userId", "seq"])
        .index("by_user_and_localId", ["userId", "localId"]),
});
