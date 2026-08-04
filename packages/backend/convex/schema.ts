import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { marketRateType, rateSource } from "./lib/currencies";
import {
	appMetaFields,
	budgetFields,
	categoryFields,
	mainBudgetFields,
	replicated,
	tagFields,
	templateTransactionFields,
	transactionColumns,
	transactionPhotoFields,
	transactionSplitFields,
	transactionTagFields,
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
 * Every replicated table carries exactly two indexes. `by_user_and_seq` is the
 * pull cursor — a fresh device walks it from 0 and an established one from its
 * watermark. `by_user_and_localId` is the push upsert lookup. Nothing else is
 * indexed because nothing else queries these tables: every read the app performs
 * on this data runs against the local SQLite replica, not here.
 */
export default defineSchema({
	/**
	 * Market exchange rates, quoted per USD. Written only by the fetcher crons and
	 * bounded by `pruneStale`.
	 *
	 * `date` is a UTC `YYYY-MM-DD` string rather than an epoch so the composite
	 * index reads as a calendar and `resolveRateOnDate` can ask for "the newest row
	 * on or before this day", which is what covers the weekend and holiday gaps in
	 * the provider feed.
	 */
	exchangeRates: defineTable({
		quote: v.string(),
		rateType: marketRateType,
		source: rateSource,
		rate: v.number(),
		date: v.string(),
		fetchedAt: v.number(),
	})
		.index("by_quote_and_rateType_and_date", ["quote", "rateType", "date"])
		.index("by_date", ["date"]),

	/**
	 * One document per user, holding the counter that stamps `seq`. Bumped once
	 * per push batch rather than once per row, so a three-device household is
	 * nowhere near the write contention that would make a single hot document a
	 * problem.
	 */
	syncState: defineTable({
		userId: v.string(),
		nextSeq: v.number(),
	}).index("by_user", ["userId"]),

	/**
	 * `parentId` holds another category's `localId`, not a Convex `Id`. The whole
	 * point of the envelope is that a row's identity survives a device that has
	 * never synced, so foreign keys stay in local-id space on both sides.
	 */
	categories: defineTable({ ...replicated, ...categoryFields })
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
		.index("by_user_and_localId", ["userId", "localId"]),

	/**
	 * SQLite declares `categoryId` unique; Convex has no unique constraint and
	 * this table deliberately does not fake one. Two offline devices can each
	 * create a budget for the same category, and the merge that reconciles them
	 * runs on the client — see "Two rows that must be one" in the design doc.
	 */
	budgets: defineTable({ ...replicated, ...budgetFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/** Singleton by convention only, for the same reason `budgets` is. */
	mainBudget: defineTable({ ...replicated, ...mainBudgetFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	templateTransactions: defineTable({
		...replicated,
		...templateTransactionFields,
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/**
	 * A label that crosses categories, and the join that attaches it. The join
	 * carries its own `localId` rather than keying on the pair, because that is
	 * what the envelope addresses rows by and what a tombstone has to name.
	 */
	tags: defineTable({ ...replicated, ...tagFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	transactionTags: defineTable({ ...replicated, ...transactionTagFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/**
	 * One entry's amount attributed to one category. No rows means the entry is
	 * attributed wholly to its own `categoryId` — see `domain/split.ts`.
	 */
	transactionSplits: defineTable({ ...replicated, ...transactionSplitFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/** A photo attached to an entry. The bytes travel out of band, as ever. */
	transactionPhotos: defineTable({ ...replicated, ...transactionPhotoFields })
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

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
		userId: v.string(),
		key: v.string(),
		seq: v.number(),
		deviceId: v.string(),
		updatedAt: v.number(),
		...appMetaFields,
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_key", ["userId", "key"]),

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
	}).index("by_key", ["key"]),

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
		userId: v.string(),
		key: v.string(),
		bytes: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_key", ["key"]),

	/**
	 * Globally shared, no `userId` by construction — same shape as
	 * `exchangeRates` and `photoObjects` above. Exactly one index and exactly
	 * one exact-key reader (`merchantKnowledge.lookup`, internal-only): a
	 * prefix or range index here would be an enumeration surface over a
	 * shared table (see the merchantKnowledge module's own doc comment).
	 */
	merchantKnowledge: defineTable({
		key: v.string(),
		domain: v.string(),
		categoryName: v.string(),
		parentCategoryName: v.union(v.string(), v.null()),
		emoji: v.union(v.string(), v.null()),
		tags: v.array(v.string()),
		resolvedAt: v.number(),
		modelId: v.string(),
	}).index("by_key", ["key"]),

	/**
	 * The grounded-lookup invoice. No key, no user, no merchant name — only what
	 * was spent and whether it published, so `groundedSpend.monthlyTotal` (the
	 * only reader, internal-only) can tighten the env-configured unit prices
	 * from observed data without ever exposing a per-merchant spend trail.
	 */
	groundedSpend: defineTable({
		at: v.number(),
		chargedMicros: v.number(),
		actualMicros: v.number(),
		searchCalls: v.number(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		published: v.boolean(),
	}).index("by_at", ["at"]),
});
