import { v } from "convex/values";

/**
 * The replication envelope and the per-table payloads, declared once so
 * `schema.ts` (what is stored) and `sync.ts` (what is accepted and served)
 * cannot drift. A column added to one and not the other would replicate as
 * silently missing data, which no test on either side alone would catch.
 */
export const replicated = {
	userId: v.string(),
	localId: v.string(),
	seq: v.number(),
	deviceId: v.string(),
	/** Client wall clock at the edit, mirroring the SQLite `updatedAt`. */
	updatedAt: v.number(),
	/** Soft-delete tombstone; rows are never removed from this table. */
	deletedAt: v.union(v.number(), v.null()),
};

export const categoryFields = {
	name: v.union(v.string(), v.null()),
	color: v.union(v.string(), v.null()),
	icon: v.union(v.string(), v.null()),
	emoji: v.union(v.string(), v.null()),
	income: v.boolean(),
	sortOrder: v.number(),
	dateCreated: v.union(v.number(), v.null()),
	parentId: v.union(v.string(), v.null()),
};

export const transactionFields = {
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
	/**
	 * The photo's R2 object key, or null. Not a url: `r2.getUrl` mints a signed
	 * one with a 15-minute default lifetime, so a stored url is stale before the
	 * next launch. The key is the stable half and every read re-mints from it.
	 */
	imageKey: v.union(v.string(), v.null()),
	onceRecurring: v.boolean(),
	recurringType: v.number(),
	recurringCoefficient: v.number(),
	recurringEndDate: v.union(v.number(), v.null()),
	categoryId: v.union(v.string(), v.null()),
	amountUsd: v.union(v.number(), v.null()),
	exchangeRate: v.union(v.number(), v.null()),
	exchangeRateType: v.union(v.string(), v.null()),
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
	imageUri: v.optional(v.union(v.string(), v.null())),
};

export const budgetFields = {
	name: v.union(v.string(), v.null()),
	amount: v.number(),
	type: v.number(),
	startDate: v.union(v.number(), v.null()),
	dateCreated: v.union(v.number(), v.null()),
	currency: v.union(v.string(), v.null()),
	amountUsd: v.union(v.number(), v.null()),
	green: v.boolean(),
	rollover: v.boolean(),
	categoryId: v.union(v.string(), v.null()),
};

export const mainBudgetFields = {
	name: v.union(v.string(), v.null()),
	amount: v.number(),
	type: v.number(),
	startDate: v.union(v.number(), v.null()),
	dateCreated: v.union(v.number(), v.null()),
	currency: v.union(v.string(), v.null()),
	amountUsd: v.union(v.number(), v.null()),
	green: v.boolean(),
	rollover: v.boolean(),
};

export const templateTransactionFields = {
	amount: v.number(),
	income: v.boolean(),
	note: v.union(v.string(), v.null()),
	sortOrder: v.number(),
	recurringType: v.number(),
	recurringCoefficient: v.number(),
	categoryId: v.union(v.string(), v.null()),
};

export const appMetaFields = {
	value: v.union(v.string(), v.null()),
};

export const tagFields = {
	name: v.string(),
	color: v.union(v.string(), v.null()),
	sortOrder: v.number(),
};

/**
 * The join carries its own id: the replication envelope addresses rows by
 * `localId`, and a composite key has nothing for a tombstone to name.
 */
export const transactionTagFields = {
	transactionId: v.string(),
	tagId: v.string(),
};

/** `imageUri` is absent: it is a path into one device's container. */
export const transactionPhotoFields = {
	transactionId: v.string(),
	imageKey: v.union(v.string(), v.null()),
	imageColor: v.union(v.string(), v.null()),
	sortOrder: v.number(),
};

export const TOMBSTONED_TABLES = [
	"categories",
	"transactions",
	"budgets",
	"mainBudget",
	"templateTransactions",
	"tags",
	"transactionTags",
	"transactionPhotos",
] as const;

/**
 * Pull order only. `appMeta` is last because it is the one table whose identity
 * is a key rather than a `localId`, so nothing else keys off its position.
 */
export const SYNCED_TABLES = [...TOMBSTONED_TABLES, "appMeta"] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const FIELDS_BY_TABLE = {
	categories: categoryFields,
	transactions: transactionFields,
	budgets: budgetFields,
	mainBudget: mainBudgetFields,
	templateTransactions: templateTransactionFields,
	tags: tagFields,
	transactionTags: transactionTagFields,
	transactionPhotos: transactionPhotoFields,
	appMeta: appMetaFields,
} as const;

interface Versioned {
	updatedAt: number;
	deletedAt: number | null;
	deviceId: string;
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
export function incomingWins(
	incoming: Versioned,
	existing: Versioned | null,
): boolean {
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
