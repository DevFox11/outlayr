import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { marketRateType, rateSource } from "./lib/currencies";

/**
 * Every replicated row carries this envelope. See `docs/convex-sync-design.md`.
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
const replicated = {
	userId: v.string(),
	localId: v.string(),
	seq: v.number(),
	deviceId: v.string(),
	/** Client wall clock at the edit, mirroring the SQLite `updatedAt`. */
	updatedAt: v.number(),
	/** Soft-delete tombstone; rows are never removed from this table. */
	deletedAt: v.union(v.number(), v.null()),
};

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
	categories: defineTable({
		...replicated,
		name: v.union(v.string(), v.null()),
		color: v.union(v.string(), v.null()),
		icon: v.union(v.string(), v.null()),
		emoji: v.union(v.string(), v.null()),
		income: v.boolean(),
		sortOrder: v.number(),
		dateCreated: v.union(v.number(), v.null()),
		parentId: v.union(v.string(), v.null()),
	})
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
	 * `imageUri` is a device-local `file://` path and means nothing on another
	 * device — see the photo-durability caveat in the design doc.
	 */
	transactions: defineTable({
		...replicated,
		amount: v.number(),
		income: v.boolean(),
		currency: v.union(v.string(), v.null()),
		note: v.string(),
		details: v.union(v.string(), v.null()),
		date: v.number(),
		day: v.number(),
		month: v.number(),
		icon: v.union(v.string(), v.null()),
		emoji: v.union(v.string(), v.null()),
		customColor: v.union(v.string(), v.null()),
		imageColor: v.union(v.string(), v.null()),
		imageUri: v.union(v.string(), v.null()),
		onceRecurring: v.boolean(),
		recurringType: v.number(),
		recurringCoefficient: v.number(),
		recurringEndDate: v.union(v.number(), v.null()),
		categoryId: v.union(v.string(), v.null()),
		amountUsd: v.union(v.number(), v.null()),
		exchangeRate: v.union(v.number(), v.null()),
		exchangeRateType: v.union(v.string(), v.null()),
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/**
	 * SQLite declares `categoryId` unique; Convex has no unique constraint and
	 * this table deliberately does not fake one. Two offline devices can each
	 * create a budget for the same category, and the merge that reconciles them
	 * runs on the client — see "Two rows that must be one" in the design doc.
	 */
	budgets: defineTable({
		...replicated,
		name: v.union(v.string(), v.null()),
		amount: v.number(),
		type: v.number(),
		startDate: v.union(v.number(), v.null()),
		dateCreated: v.union(v.number(), v.null()),
		currency: v.union(v.string(), v.null()),
		amountUsd: v.union(v.number(), v.null()),
		green: v.boolean(),
		categoryId: v.union(v.string(), v.null()),
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	/** Singleton by convention only, for the same reason `budgets` is. */
	mainBudget: defineTable({
		...replicated,
		name: v.union(v.string(), v.null()),
		amount: v.number(),
		type: v.number(),
		startDate: v.union(v.number(), v.null()),
		dateCreated: v.union(v.number(), v.null()),
		currency: v.union(v.string(), v.null()),
		amountUsd: v.union(v.number(), v.null()),
		green: v.boolean(),
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_localId", ["userId", "localId"]),

	templateTransactions: defineTable({
		...replicated,
		amount: v.number(),
		income: v.boolean(),
		note: v.union(v.string(), v.null()),
		sortOrder: v.number(),
		recurringType: v.number(),
		recurringCoefficient: v.number(),
		categoryId: v.union(v.string(), v.null()),
	})
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
		value: v.union(v.string(), v.null()),
		seq: v.number(),
		deviceId: v.string(),
		updatedAt: v.number(),
	})
		.index("by_user_and_seq", ["userId", "seq"])
		.index("by_user_and_key", ["userId", "key"]),
});
