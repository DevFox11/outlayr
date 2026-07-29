import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { canonicalUsd } from "@/domain/canonical-usd";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { newId } from "@/domain/ids";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { nextDate, RECURRING_TYPE } from "@/domain/recurrence";
import { getMeta, META_KEYS } from "./app-meta-core";
import { localRateLookup } from "./rates";

type TransactionRow = typeof transactions.$inferSelect;

async function loadSource(
	db: Database,
	id: string,
): Promise<TransactionRow | null> {
	const rows = await db
		.select()
		.from(transactions)
		.where(eq(transactions.id, id))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * A subscription is persisted as a single recurring row. This walks its schedule
 * forward to today, writing one plain (non-recurring) row per occurrence, then
 * retires the source to `recurringType = none`. Mirrors the Swift
 * `TransactionRepository.updateRecurringTransaction` back-fill.
 *
 * Exactly one row in the chain carries `recurringType > 0` at a time: the
 * schedule migrates onto the newest generated row, which is the one
 * {@link backfillAllRecurring} picks up on the next sweep.
 *
 * The `advanced <= holding` break is a defensive stop against a malformed
 * coefficient that fails to advance the schedule.
 */
export async function backfillRecurring(
	db: Database,
	id: string,
	now: Date = new Date(),
): Promise<void> {
	const source = await loadSource(db, id);
	if (
		source == null ||
		!source.onceRecurring ||
		source.recurringType === RECURRING_TYPE.none
	) {
		return;
	}

	const type = source.recurringType;
	const coefficient = source.recurringCoefficient;
	const today = startOfDay(now);
	const endLimit =
		source.recurringEndDate == null
			? null
			: startOfDay(source.recurringEndDate);
	const withinEndLimit = (d: Date): boolean =>
		endLimit == null || startOfDay(d).getTime() <= endLimit.getTime();

	const occurrenceAt = (
		holding: Date,
		carriesSchedule: boolean,
	): typeof transactions.$inferInsert => ({
		id: newId(),
		amount: source.amount,
		income: source.income,
		currency: source.currency,
		note: source.note,
		details: source.details,
		date: holding,
		day: startOfDay(holding),
		month: firstOfMonth(holding),
		icon: source.icon,
		emoji: source.emoji,
		customColor: source.customColor,
		imageColor: source.imageColor,
		imageUri: source.imageUri,
		onceRecurring: true,
		recurringType: carriesSchedule ? type : RECURRING_TYPE.none,
		recurringCoefficient: carriesSchedule ? coefficient : 1,
		recurringEndDate: carriesSchedule ? source.recurringEndDate : null,
		categoryId: source.categoryId,
		updatedAt: now,
		deletedAt: null,
	});

	const next = nextDate(source.date, type, coefficient) ?? source.date;
	const pending: (typeof transactions.$inferInsert)[] = [];

	// A row may only inherit the schedule when its own next charge is strictly
	// ahead of both today and itself: an occurrence that would land today again
	// hands the same charge to the next sweep, forever.
	const carriesFrom = (holding: Date, advanced: Date | null): boolean =>
		advanced != null &&
		startOfDay(advanced).getTime() > today.getTime() &&
		startOfDay(advanced).getTime() > startOfDay(holding).getTime() &&
		withinEndLimit(advanced);

	if (startOfDay(next).getTime() < today.getTime()) {
		let holding = next;
		while (
			startOfDay(holding).getTime() <= today.getTime() &&
			withinEndLimit(holding)
		) {
			const advanced = nextDate(holding, type, coefficient);
			pending.push(occurrenceAt(holding, carriesFrom(holding, advanced)));
			if (advanced == null) {
				break;
			}
			if (startOfDay(advanced).getTime() <= startOfDay(holding).getTime()) {
				break;
			}
			holding = advanced;
		}
	} else if (startOfDay(next).getTime() === today.getTime()) {
		if (withinEndLimit(next)) {
			const advanced = nextDate(next, type, coefficient);
			pending.push(occurrenceAt(next, carriesFrom(next, advanced)));
		}
	} else {
		return;
	}

	// Each occurrence is canonicalized at ITS OWN date, not the source's: copying
	// the source's frozen USD value onto every charge would price January's
	// payment at December's rate. Built outside the write transaction because the
	// rate lookup reads.
	const lookup = localRateLookup(db);
	const display = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
	const canonicalized = await Promise.all(
		pending.map(async (row) => ({
			...row,
			...(await canonicalUsd(lookup, {
				amount: row.amount,
				currency: row.currency ?? null,
				displayCurrency: display,
				date: row.date,
			})),
		})),
	);

	// Atomic on purpose: dying between the insert and the retire leaves the source
	// still flagged recurring, so the next launch walks the same schedule again
	// and writes every occurrence a second time.
	await withTransaction(db, async () => {
		if (canonicalized.length > 0) {
			await db.insert(transactions).values(canonicalized);
		}
		await db
			.update(transactions)
			.set({ recurringType: RECURRING_TYPE.none, updatedAt: now })
			.where(eq(transactions.id, source.id));
	});
}

/**
 * The app-open / foreground sweep. Without it a subscription only ever advances
 * on the save that created it, since the form is the back-fill's sole other
 * caller.
 *
 * The id list is resolved up front on purpose: each back-fill hands the schedule
 * to a freshly inserted row whose next charge is, by construction, in the
 * future, so re-reading the table mid-sweep would pick those rows up for no work.
 *
 * Sequential rather than concurrent: each iteration writes, and the rows share
 * one SQLite connection.
 */
export async function backfillAllRecurring(
	db: Database,
	now: Date = new Date(),
): Promise<void> {
	const live = await db
		.select({ id: transactions.id })
		.from(transactions)
		.where(
			and(
				gt(transactions.recurringType, RECURRING_TYPE.none),
				isNull(transactions.deletedAt),
			),
		);

	for (const row of live) {
		await backfillRecurring(db, row.id, now);
	}
}
