import { addDays, startOfDay } from "./dates";

/**
 * Mirrors the Swift `RecurringCadence` raw values so a transaction's persisted
 * `recurringType` reads identically across the two apps.
 */
export const RECURRING_TYPE = {
	none: 0,
	daily: 1,
	weekly: 2,
	monthly: 3,
	yearly: 4,
} as const;

export type RecurringType =
	(typeof RECURRING_TYPE)[keyof typeof RECURRING_TYPE];

/** In the order the picker renders them. */
export const SELECTABLE_RECURRING_TYPES: readonly RecurringType[] = [
	RECURRING_TYPE.daily,
	RECURRING_TYPE.weekly,
	RECURRING_TYPE.monthly,
	RECURRING_TYPE.yearly,
];

const UNIT_SINGULAR: Record<number, string> = {
	1: "day",
	2: "week",
	3: "month",
	4: "year",
};

export function cadenceUnit(type: number): string {
	return UNIT_SINGULAR[type] ?? "month";
}

/** Adds `n` whole months keeping the day-of-month where the target month allows. */
function addMonths(date: Date, n: number): Date {
	const d = new Date(date);
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + n);
	const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
	d.setDate(Math.min(day, lastDay));
	return d;
}

/**
 * The next occurrence after `from`, or `null` when the type is non-recurring.
 * Day/week advance by exact days; month/year advance by calendar units clamped
 * to a valid day-of-month.
 */
export function nextDate(
	from: Date,
	type: number,
	coefficient: number,
): Date | null {
	const n = Math.max(1, Math.round(coefficient));
	switch (type) {
		case RECURRING_TYPE.daily:
			return addDays(from, n);
		case RECURRING_TYPE.weekly:
			return addDays(from, 7 * n);
		case RECURRING_TYPE.monthly:
			return addMonths(from, n);
		case RECURRING_TYPE.yearly:
			return addMonths(from, 12 * n);
		default:
			return null;
	}
}

/** Alias for {@link nextDate}. */
export const next = nextDate;

/**
 * The first occurrence of `from`'s schedule strictly after today, or null when
 * the schedule cannot advance or has run past its end date. `from` counts as a
 * member of its own schedule, so a charge still ahead of today is the landing
 * rather than something to step past — anything else would name the charge one
 * whole cadence beyond the one the ledger is about to take.
 *
 * Walked rather than projected so month-length clamping matches every occurrence
 * the back-fill writes.
 */
export function nextLanding(
	from: Date,
	type: number,
	coefficient: number,
	endDate: Date | null,
	now: Date,
): Date | null {
	const today = startOfDay(now);
	const endLimit = endDate == null ? null : startOfDay(endDate);
	const advance = (at: Date): Date | null => nextDate(at, type, coefficient);
	const pastEndLimit = (at: Date): boolean =>
		endLimit != null && startOfDay(at).getTime() > endLimit.getTime();

	// A row with no cadence has no schedule to land on, checked before `from`
	// itself is considered so a future-dated one-off can never be mistaken for a
	// pending subscription charge.
	if (advance(from) == null) {
		return null;
	}

	// Strictly after, never on: `scheduleSuccessor` hands this a carrier dated
	// today-or-earlier, and returning a same-day `from` would make it the
	// successor of itself and stall the chain on one charge forever.
	if (startOfDay(from).getTime() > today.getTime()) {
		return pastEndLimit(from) ? null : from;
	}

	let holding = from;
	let advanced = advance(holding);
	while (
		advanced != null &&
		startOfDay(advanced).getTime() > startOfDay(holding).getTime()
	) {
		if (pastEndLimit(advanced)) {
			return null;
		}
		if (startOfDay(advanced).getTime() > today.getTime()) {
			return advanced;
		}
		holding = advanced;
		advanced = advance(holding);
	}
	return null;
}
