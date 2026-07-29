import { addDays } from "./dates";

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

const UNIT_PLURAL: Record<number, string> = {
	1: "days",
	2: "weeks",
	3: "months",
	4: "years",
};

const NAMED_LABEL: Record<number, string> = {
	1: "Daily",
	2: "Weekly",
	3: "Monthly",
	4: "Yearly",
};

const UNIT_TITLE: Record<number, string> = {
	1: "Days",
	2: "Weeks",
	3: "Months",
	4: "Years",
};

export function cadenceLabel(type: number): string {
	return NAMED_LABEL[type] ?? "Monthly";
}

export function cadenceUnit(type: number): string {
	return UNIT_SINGULAR[type] ?? "month";
}

/** Mirrors the Swift `RecurringCadence.unitTitle`. */
export function cadenceUnitTitle(type: number): string {
	return UNIT_TITLE[type] ?? "Months";
}

/** Mirrors the Swift `CustomScheduleSheet.preview`. */
export function customSchedulePreview(
	type: number,
	coefficient: number,
): string {
	const n = Math.max(1, Math.round(coefficient));
	if (n <= 1) {
		return `Repeats every ${cadenceUnit(type)}`;
	}
	return `Repeats every ${n} ${UNIT_PLURAL[type] ?? "months"}`;
}

/** Mirrors the Swift `scheduleLabel(coefficient:)`. */
export function scheduleLabel(type: number, coefficient: number): string {
	const n = Math.max(1, Math.round(coefficient));
	if (n <= 1) {
		return `Every ${UNIT_SINGULAR[type] ?? "month"}`;
	}
	return `Every ${n} ${UNIT_PLURAL[type] ?? "months"}`;
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
