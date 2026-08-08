import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { canonicalUsd } from "@/domain/canonical-usd";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { nextDate, nextLanding, RECURRING_TYPE } from "@/domain/recurrence";
import { uuidV5 } from "@/domain/uuid5";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { localRateLookup } from "./rates";

type TransactionRow = typeof transactions.$inferSelect;
type TransactionInsert = typeof transactions.$inferInsert;

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
 * Minted once for this derivation and never changed: a different namespace
 * would make every device that upgraded compute different ids for occurrences
 * the others already hold.
 */
const OCCURRENCE_NAMESPACE = "0f2b9f1e-6d3a-4c58-9a71-2c8f5d6e4b31";

/**
 * The id of the charge `source` makes on `holding`, derived rather than minted.
 *
 * Two synced devices both sweep the same schedule, and with `newId()` each
 * would insert its own copy of the same charge — the ledger would double every
 * subscription. Derived from the pair that actually identifies the occurrence,
 * both devices compute the same id and the second one upserts.
 *
 * The day, not the timestamp: the sweep walks the schedule in whole days, and
 * two devices in different time zones must still land on one id.
 */
export function occurrenceId(parentLocalId: string, holding: Date): string {
	return uuidV5(
		`${parentLocalId}:${startOfDay(holding).getTime()}`,
		OCCURRENCE_NAMESPACE,
	);
}

/**
 * The day the chain is anchored to. Falling back to the row's own day is what
 * keeps a chain written before the column existed walking exactly as it did.
 */
function anchorDayOf(source: TransactionRow): number {
	return source.recurringAnchorDay ?? source.date.getDate();
}

function occurrenceRow(
	source: TransactionRow,
	holding: Date,
	carriesSchedule: boolean,
	now: Date,
): TransactionInsert {
	return {
		id: occurrenceId(source.id, holding),
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
		imageKey: source.imageKey,
		onceRecurring: true,
		recurringType: carriesSchedule ? source.recurringType : RECURRING_TYPE.none,
		recurringCoefficient: carriesSchedule ? source.recurringCoefficient : 1,
		recurringEndDate: carriesSchedule ? source.recurringEndDate : null,
		recurringAnchorDay: carriesSchedule ? anchorDayOf(source) : null,
		reminderLeadDays: carriesSchedule ? source.reminderLeadDays : null,
		categoryId: source.categoryId,
		updatedAt: now,
		deletedAt: null,
	};
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
	const anchorDay = anchorDayOf(source);
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
	): TransactionInsert => occurrenceRow(source, holding, carriesSchedule, now);

	const next =
		nextDate(source.date, type, coefficient, anchorDay) ?? source.date;
	const pending: TransactionInsert[] = [];

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
			const advanced = nextDate(holding, type, coefficient, anchorDay);
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
			const advanced = nextDate(next, type, coefficient, anchorDay);
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
			// Ignored rather than overwritten: an occurrence already under this id is
			// the same charge replicated from another device, and it may carry an
			// edit — or a deletion — this device has no business undoing.
			await db.insert(transactions).values(canonicalized).onConflictDoNothing();
		}
		await db
			.update(transactions)
			.set({
				recurringType: RECURRING_TYPE.none,
				reminderLeadDays: null,
				updatedAt: now,
			})
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

async function withCanonicalUsd(
	db: Database,
	row: TransactionInsert,
): Promise<TransactionInsert> {
	const display = (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY;
	return {
		...row,
		...(await canonicalUsd(localRateLookup(db), {
			amount: row.amount,
			currency: row.currency ?? null,
			displayCurrency: display,
			date: row.date,
		})),
	};
}

/**
 * The row that keeps a chain alive once `carrier` stops anchoring it, or null
 * when there is nothing left to keep alive.
 *
 * Anchored at the next occurrence *after today* rather than at the carrier's own
 * next charge: a carrier that sat stale resumes going forward instead of
 * back-charging the gap it slept through.
 *
 * A carrier dated in the future is the pending charge itself rather than a
 * settled one, so removing it is the only way the schema can say "stop" — that
 * one gets no successor.
 *
 * Built outside the caller's write transaction because canonicalizing it reads
 * the rate replica.
 */
export async function scheduleSuccessor(
	db: Database,
	carrier: TransactionRow,
	now: Date,
): Promise<TransactionInsert | null> {
	if (!carrier.onceRecurring || carrier.recurringType === RECURRING_TYPE.none) {
		return null;
	}
	if (startOfDay(carrier.date).getTime() > startOfDay(now).getTime()) {
		return null;
	}
	const landing = nextLanding(
		carrier.date,
		carrier.recurringType,
		carrier.recurringCoefficient,
		carrier.recurringEndDate,
		now,
		anchorDayOf(carrier),
	);
	if (landing == null) {
		return null;
	}
	return await withCanonicalUsd(db, occurrenceRow(carrier, landing, true, now));
}

/**
 * One-shot repair for chains whose carrier was soft-deleted before the delete
 * handover existed. The tombstone still holds the whole schedule, so each chain
 * is reinstated from its own row — nothing here is inferred.
 *
 * Chains orphaned any other way are unrecoverable: retiring a row overwrites its
 * cadence and no column links a chain's rows together, so neither the schedule
 * nor its membership survives anywhere to be read back.
 *
 * Guarded twice over — the marker skips the pass, and clearing every tombstone it
 * examines empties the predicate that selected them.
 */
export async function repairOrphanedRecurrence(
	db: Database,
	now: Date = new Date(),
): Promise<number> {
	if ((await getMeta(db, META_KEYS.recurrenceRepaired)) === "true") {
		return 0;
	}

	const orphaned = await db
		.select()
		.from(transactions)
		.where(
			and(
				isNotNull(transactions.deletedAt),
				eq(transactions.onceRecurring, true),
				gt(transactions.recurringType, RECURRING_TYPE.none),
			),
		);

	let reinstated = 0;
	for (const carrier of orphaned) {
		const successor = await scheduleSuccessor(db, carrier, now);
		await withTransaction(db, async () => {
			if (successor != null) {
				await db.insert(transactions).values(successor).onConflictDoNothing();
			}
			await db
				.update(transactions)
				.set({
					recurringType: RECURRING_TYPE.none,
					reminderLeadDays: null,
					updatedAt: now,
				})
				.where(eq(transactions.id, carrier.id));
		});
		if (successor != null) {
			reinstated += 1;
		}
	}

	await setMeta(db, META_KEYS.recurrenceRepaired, "true");
	return reinstated;
}
