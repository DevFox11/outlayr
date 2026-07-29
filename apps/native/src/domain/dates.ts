const WEEKDAYS = [
	"SUNDAY",
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
] as const;

const MONTHS = [
	"JAN",
	"FEB",
	"MAR",
	"APR",
	"MAY",
	"JUN",
	"JUL",
	"AUG",
	"SEP",
	"OCT",
	"NOV",
	"DEC",
] as const;

const MONTHS_LONG = [
	"JANUARY",
	"FEBRUARY",
	"MARCH",
	"APRIL",
	"MAY",
	"JUNE",
	"JULY",
	"AUGUST",
	"SEPTEMBER",
	"OCTOBER",
	"NOVEMBER",
	"DECEMBER",
] as const;

/** `firstWeekday` is 1 = Sunday, 2 = Monday; `firstDayOfMonth` is 1–28. */
export interface CalendarSettings {
	firstWeekday: number;
	firstDayOfMonth: number;
}

/** Matches `SETTING_DEFAULTS`. */
export const DEFAULT_CALENDAR: CalendarSettings = {
	firstWeekday: 1,
	firstDayOfMonth: 1,
};

/** Local-calendar midnight of the given instant. */
export function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** First local instant of the given instant's month. */
export function firstOfMonth(date: Date): Date {
	const d = new Date(date);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Midnight on the most recent `firstWeekday` (1 = Sunday, 2 = Monday — the
 * `firstWeekday` setting's own encoding). Defaults to Sunday, which is what the
 * setting defaults to.
 */
export function startOfWeek(date: Date, firstWeekday = 1): Date {
	const d = startOfDay(date);
	const offset = (d.getDay() - (firstWeekday - 1) + 7) % 7;
	d.setDate(d.getDate() - offset);
	return d;
}

/** Mirrors Swift's `getStartOfMonth`. */
export function monthPeriodStart(date: Date, firstDayOfMonth = 1): Date {
	const anchor = Math.min(Math.max(1, firstDayOfMonth), 28);
	const start = startOfDay(date);
	if (start.getDate() < anchor) {
		start.setMonth(start.getMonth() - 1);
	}
	start.setDate(anchor);
	return start;
}

export function startOfYear(date: Date): Date {
	const d = new Date(date);
	d.setMonth(0, 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Adds `n` days keeping local wall time (DST-tolerant, like Calendar `.day`). */
export function addDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

/**
 * Adds `n` calendar months. Insights bucketing only ever calls this on a
 * first-of-month anchor, so no month-length clamping is needed — the day stays 1.
 */
export function addMonths(date: Date, n: number): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + n);
	return d;
}

/** Uppercase three-letter month, e.g. "JUL". */
export function monthAbbrev(date: Date): string {
	return MONTHS[date.getMonth()];
}

/** Single-letter weekday, e.g. "M". */
export function weekdayInitial(date: Date): string {
	return WEEKDAYS[date.getDay()][0];
}

export function isFuture(date: Date, now: Date = new Date()): boolean {
	return date.getTime() > now.getTime();
}

/**
 * Uppercased section header, per Swift's `dateConverter`: TODAY / YESTERDAY /
 * "FRI, 24 JUL" — and "FRI, 24 JUL '25" once the day falls before the current
 * year.
 */
export function formatDayHeader(day: Date, now: Date = new Date()): string {
	const today = startOfDay(now).getTime();
	const target = startOfDay(day).getTime();
	const oneDay = 86_400_000;
	if (target === today) {
		return "TODAY";
	}
	if (target === today - oneDay) {
		return "YESTERDAY";
	}
	const base = `${WEEKDAYS[day.getDay()].slice(0, 3)}, ${day.getDate()} ${
		MONTHS[day.getMonth()]
	}`;
	return day.getFullYear() < now.getFullYear()
		? `${base} '${String(day.getFullYear()).slice(-2)}`
		: base;
}

/** "24 JUL", per Swift's `dateFormatter`. */
export function formatUpcomingDate(date: Date): string {
	return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "h:mm a" wall-clock time, e.g. "9:04 PM". */
export function formatTime(date: Date): string {
	let hours = date.getHours();
	const minutes = date.getMinutes();
	const meridiem = hours >= 12 ? "PM" : "AM";
	hours %= 12;
	if (hours === 0) {
		hours = 12;
	}
	const mm = minutes < 10 ? `0${minutes}` : String(minutes);
	return `${hours}:${mm} ${meridiem}`;
}

export function formatMonthLabel(date: Date): string {
	return MONTHS_LONG[date.getMonth()];
}

/** "Mon D, YYYY", title case. */
export function formatDateRow(date: Date): string {
	const months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
