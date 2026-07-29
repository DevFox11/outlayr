import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { type CanonicalUsd, canonicalUsd } from "@/domain/canonical-usd";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { newId } from "@/domain/ids";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { getMeta, META_KEYS } from "./app-meta-core";
import type { SpendDb } from "./budget-spent";
import { getCategoryById } from "./categories-core";
import { localRateLookup } from "./rates";
import { scheduleSuccessor } from "./recurrence-backfill";

export const LOG_PAGE_DAYS = 30;

/**
 * A narrow column set on purpose: `details` is unbounded free text and nothing
 * in the list paints it.
 */
export const LOG_COLUMNS = {
	id: transactions.id,
	amount: transactions.amount,
	income: transactions.income,
	currency: transactions.currency,
	// Carried so a mixed-currency day can total as one figure.
	amountUsd: transactions.amountUsd,
	note: transactions.note,
	date: transactions.date,
	day: transactions.day,
	icon: transactions.icon,
	emoji: transactions.emoji,
	customColor: transactions.customColor,
	imageColor: transactions.imageColor,
	imageUri: transactions.imageUri,
	recurringType: transactions.recurringType,
	// Upcoming projects each scheduled entry forward, which needs the interval as
	// well as the cadence.
	recurringCoefficient: transactions.recurringCoefficient,
	categoryId: transactions.categoryId,
} as const;

function visibleAt(nowMs: number) {
	return and(
		isNull(transactions.deletedAt),
		lte(transactions.date, new Date(nowMs)),
	);
}

/**
 * The window is measured in **days, not rows**, because the Log prints a signed
 * subtotal per day: a plain row LIMIT would cut some day in half and print a
 * total for it that is simply wrong.
 *
 * Returned as a query builder rather than run here so the hook can run it in
 * render while the tests await it directly.
 */
export function logWindowDaysQuery(db: SpendDb, nowMs: number, days: number) {
	return db
		.selectDistinct({ day: transactions.day })
		.from(transactions)
		.where(visibleAt(nowMs))
		.orderBy(desc(transactions.day))
		.limit(days);
}

/**
 * Every row the user still has, tombstones excluded — the figure the erase
 * screen prints, which has to fall to zero the moment an erase lands.
 */
export function ledgerSizeQuery(db: SpendDb) {
	return db
		.select({ id: transactions.id })
		.from(transactions)
		.where(isNull(transactions.deletedAt));
}

/**
 * A null floor means no day matched at all, so the bound is left off rather
 * than faked.
 */
export function logWindowRowsQuery(
	db: SpendDb,
	nowMs: number,
	floorMs: number | null,
) {
	return db
		.select(LOG_COLUMNS)
		.from(transactions)
		.where(
			floorMs == null
				? visibleAt(nowMs)
				: and(visibleAt(nowMs), gte(transactions.day, new Date(floorMs))),
		)
		.orderBy(desc(transactions.day), desc(transactions.date));
}

export type Transaction = typeof transactions.$inferSelect;

export interface TransactionInput {
	amount: number;
	income: boolean;
	categoryId: string;
	note: string;
	details: string | null;
	date: Date;
	/** null = adopt the ledger's currency, which the write stamps in. */
	currency: string | null;
	/** Chosen logo icon (registry key) — mutually exclusive with `emoji`. */
	icon?: string | null;
	/** Chosen logo emoji — mutually exclusive with `icon`. */
	emoji?: string | null;
	/** Identity color override (hex). */
	customColor?: string | null;
	/** Chosen logo photo URI — mutually exclusive with `icon`/`emoji`. */
	imageUri?: string | null;
	/** Color derived for (or chosen for) a photo identity (hex). */
	imageColor?: string | null;
	/** Marks the transaction as recurring. */
	onceRecurring?: boolean;
	/** Cadence: none=0, daily=1, weekly=2, monthly=3, yearly=4. */
	recurringType?: number;
	/** Interval multiplier for the cadence (e.g. "every 2 weeks"). */
	recurringCoefficient?: number;
	recurringEndDate?: Date | null;
}

/**
 * Materializing a subscription's past charges is not done here: the form calls
 * `backfillRecurring` (`data/recurrence-backfill.ts`) after the save.
 */
async function toRow(
	db: Database,
	id: string,
	input: TransactionInput,
): Promise<typeof transactions.$inferInsert> {
	const trimmedNote = input.note.trim();
	let note = trimmedNote;
	if (note === "") {
		const category = await getCategoryById(db, input.categoryId);
		note = category?.name ?? "";
	}
	const details = input.details?.trim() ? input.details.trim() : null;
	const recurring = input.onceRecurring ?? false;
	const now = new Date();
	// Stamped even when the user picked nothing: a null currency means "whatever
	// the ledger setting says", so changing that setting would silently restate a
	// $18.50 lunch as €18.50.
	const currency = input.currency ?? (await displayCurrency(db));
	return {
		id,
		amount: Math.abs(input.amount),
		income: input.income,
		currency,
		note,
		details,
		date: input.date,
		day: startOfDay(input.date),
		month: firstOfMonth(input.date),
		categoryId: input.categoryId,
		icon: input.icon ?? null,
		emoji: input.emoji ?? null,
		customColor: input.customColor ?? null,
		imageColor: input.imageColor ?? null,
		imageUri: input.imageUri ?? null,
		onceRecurring: recurring,
		recurringType: recurring ? (input.recurringType ?? 0) : 0,
		recurringCoefficient: recurring
			? Math.max(1, input.recurringCoefficient ?? 1)
			: 1,
		recurringEndDate: recurring ? (input.recurringEndDate ?? null) : null,
		// Frozen at write with the rate of the day the money moved; converting at
		// read time would make last month's spending change every morning.
		...(await canonicalUsd(localRateLookup(db), {
			amount: Math.abs(input.amount),
			currency,
			displayCurrency: currency,
			date: input.date,
		})),
		updatedAt: now,
		deletedAt: null,
	};
}

async function displayCurrency(db: Database): Promise<string> {
	return (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
}

/**
 * The value already frozen on the row, kept when an edit leaves amount, currency
 * and date alone. Re-freezing is unsafe: the local replica is replaced wholesale
 * on every pull and the feed serves 90 days, so an older entry comes back
 * unresolvable and renaming its note would erase a value that was correct. Any
 * of the three moving returns null instead, which the next backfill pass retries.
 */
function keptCanonical(
	next: typeof transactions.$inferInsert,
	previous: Transaction | null,
): CanonicalUsd | null {
	if (
		previous?.amountUsd == null ||
		previous.amount !== next.amount ||
		previous.currency !== next.currency ||
		previous.date.getTime() !== next.date.getTime()
	) {
		return null;
	}
	return {
		amountUsd: previous.amountUsd,
		exchangeRate: previous.exchangeRate,
		exchangeRateType: previous.exchangeRateType,
	};
}

/**
 * Whether this edit is the user taking the photo off the transaction, as
 * opposed to saving a row whose photo this device simply has not fetched yet.
 *
 * Only the first clears `imageKey`, which is what stops the photo downloader
 * from putting the picture back. The distinction matters because a synced row
 * whose bytes have not arrived also has a null path: treating a save on THAT
 * as a removal would delete a photo the user never touched, off every device.
 *
 * `imageKey` is otherwise left alone here — a photo *replaced* keeps the old
 * key until the uploader records the new one, which is how the uploader knows
 * there is a superseded object to release.
 */
function removesPhoto(
	previous: Transaction | null,
	next: typeof transactions.$inferInsert,
): boolean {
	return previous?.imageUri != null && next.imageUri == null;
}

export const transactionsRepo = {
	async create(db: Database, input: TransactionInput): Promise<string> {
		const id = newId();
		const row = await toRow(db, id, input);
		await db.insert(transactions).values(row);
		return id;
	},

	async update(
		db: Database,
		id: string,
		input: TransactionInput,
	): Promise<void> {
		const previous = getTransactionById(db, id);
		const row = await toRow(db, id, input);
		const { id: _omit, ...rest } = row;
		const kept = keptCanonical(row, previous);
		await db
			.update(transactions)
			.set({
				...rest,
				...(kept ?? {}),
				...(removesPhoto(previous, row) ? { imageKey: null } : {}),
			})
			.where(eq(transactions.id, id));
	},

	/**
	 * Soft-deletes (tombstone). The UI defers this call behind the undo window.
	 *
	 * The newest occurrence of a subscription is both a settled charge and the
	 * chain's only live schedule, so the schedule is re-anchored on a successor
	 * before the row goes — otherwise removing one charge ends the subscription
	 * with no warning. The tombstone is retired to `none` either way, which is
	 * what makes deleting the *pending* charge the way to stop one.
	 */
	async remove(
		db: Database,
		id: string,
		now: Date = new Date(),
	): Promise<void> {
		const row = getTransactionById(db, id);
		const successor =
			row == null || row.deletedAt != null
				? null
				: await scheduleSuccessor(db, row, now);

		await withTransaction(db, async () => {
			if (successor != null) {
				// The successor's id is derived from its schedule, so a peer that
				// already anchored the same one holds the row this would duplicate.
				await db.insert(transactions).values(successor).onConflictDoNothing();
			}
			await db
				.update(transactions)
				.set({
					deletedAt: now,
					updatedAt: now,
					recurringType: RECURRING_TYPE.none,
				})
				.where(eq(transactions.id, id));
		});
	},

	/**
	 * Ends the schedule and keeps the charge. The counterpart to {@link remove}:
	 * no successor is anchored, so nothing is generated after this row, but the
	 * row itself — including a pending charge that has yet to land — stays on the
	 * ledger. `onceRecurring` is left set, so the entry still reads as a member
	 * of its chain under the Recurring filter.
	 *
	 * Tombstones are excluded because their schedule is the only record
	 * `repairOrphanedRecurrence` has left to read a broken chain back from.
	 */
	async stopRecurring(
		db: Database,
		id: string,
		now: Date = new Date(),
	): Promise<void> {
		await db
			.update(transactions)
			.set({ recurringType: RECURRING_TYPE.none, updatedAt: now })
			.where(and(eq(transactions.id, id), isNull(transactions.deletedAt)));
	},
};

/**
 * Synchronous on purpose: the expo-sqlite driver executes on the JS thread
 * (`getFirstSync`), so a caller can have the row in hand during its first render
 * instead of flashing a placeholder for one frame.
 */
export function getTransactionById(
	db: Database,
	id: string,
): Transaction | null {
	const rows = db
		.select()
		.from(transactions)
		.where(eq(transactions.id, id))
		.limit(1)
		.all();
	return rows[0] ?? null;
}
