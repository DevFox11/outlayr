import {
	type CalendarSettings,
	DEFAULT_CALENDAR,
	monthPeriodStart,
	startOfDay,
	startOfWeek,
	startOfYear,
} from "./dates";

/** Mirrors the Swift `Budget.type` codes. */
export const BUDGET_TYPE = {
	day: 1,
	week: 2,
	month: 3,
	year: 4,
} as const;

export interface BudgetWindow {
	start: Date;
	end: Date;
}

/** Adds `n` days keeping local wall time (DST-tolerant, like Calendar `.day`). */
function addDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

/**
 * Adds calendar `months`, clamping the day to the target month's length so
 * Jan 31 + 1mo → Feb 28/29 (and stays clamped on the next advance). Matches
 * Apple's `Calendar.date(byAdding: .month)`, which the rolling window relies on.
 */
function addMonthsClamped(date: Date, months: number): Date {
	const d = new Date(date);
	const day = d.getDate();
	d.setDate(1);
	d.setMonth(d.getMonth() + months);
	const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
	d.setDate(Math.min(day, daysInTarget));
	return d;
}

/** End of the single period beginning at `start`. Ports `Budget.endDate`. */
export function periodEnd(start: Date, type: number): Date {
	switch (type) {
		case BUDGET_TYPE.day:
			return addDays(start, 1);
		case BUDGET_TYPE.week:
			return addDays(start, 7);
		case BUDGET_TYPE.month:
			return addMonthsClamped(start, 1);
		case BUDGET_TYPE.year:
			return addMonthsClamped(start, 12);
		default:
			return new Date(start);
	}
}

/** The aligned start of the period — the anchor a budget is created with. */
export function startOfPeriod(
	now: Date,
	type: number,
	calendar: CalendarSettings = DEFAULT_CALENDAR,
): Date {
	switch (type) {
		case BUDGET_TYPE.day:
			return startOfDay(now);
		case BUDGET_TYPE.week:
			return startOfWeek(now, calendar.firstWeekday);
		case BUDGET_TYPE.month:
			return monthPeriodStart(now, calendar.firstDayOfMonth);
		case BUDGET_TYPE.year:
			return startOfYear(now);
		default:
			return startOfDay(now);
	}
}

/**
 * Rolls `startDate` forward whole periods until the window is the current one.
 * Ports `BudgetRepository.updateBudgetDates()`. The `end > start` guard stops an
 * unknown/zero-length type from looping forever.
 */
export function advanceBudgetWindow(
	startDate: Date,
	type: number,
	now: Date,
): BudgetWindow {
	let start = new Date(startDate);
	let end = periodEnd(start, type);
	while (end.getTime() <= now.getTime() && end.getTime() > start.getTime()) {
		start = end;
		end = periodEnd(start, type);
	}
	return { start, end };
}

export function budgetPeriodPhrase(type: number): string {
	switch (type) {
		case BUDGET_TYPE.day:
			return "today";
		case BUDGET_TYPE.week:
			return "this week";
		case BUDGET_TYPE.month:
			return "this month";
		case BUDGET_TYPE.year:
			return "this year";
		default:
			return "this period";
	}
}

export function budgetResetPhrase(type: number): string {
	switch (type) {
		case BUDGET_TYPE.day:
			return "Resets daily";
		case BUDGET_TYPE.week:
			return "Resets weekly";
		case BUDGET_TYPE.month:
			return "Resets monthly";
		case BUDGET_TYPE.year:
			return "Resets yearly";
		default:
			return "Resets each period";
	}
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function clamp01(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.max(0, Math.min(1, value));
}

export interface BudgetPace {
	/** Continuous fraction of the window already elapsed, clamped [0, 1]. */
	elapsed: number;
	/**
	 * Fraction of the window's time still remaining, on whole-day granularity —
	 * the Swift `targetPercent`.
	 */
	remaining: number;
}

/**
 * `remaining` mirrors the Swift `targetPercent = (totalDays - (daysPast + 1)) /
 * totalDays`, counting the current day as consumed so the marker leads spending.
 */
export function budgetPace(window: BudgetWindow, now: Date): BudgetPace {
	const totalMs = window.end.getTime() - window.start.getTime();
	const elapsedMs = now.getTime() - window.start.getTime();
	if (totalMs <= 0) {
		return { elapsed: 1, remaining: 0 };
	}
	const totalDays = Math.max(1, Math.round(totalMs / DAY_MS));
	const daysPast = Math.max(0, Math.floor(elapsedMs / DAY_MS)) + 1;
	return {
		elapsed: clamp01(elapsedMs / totalMs),
		remaining: clamp01((totalDays - daysPast) / totalDays),
	};
}

/** Whole days remaining in the window (Swift `numberOfDays - numberOfDaysPast`). */
export function daysLeftInWindow(window: BudgetWindow, now: Date): number {
	const totalDays = Math.max(
		1,
		Math.round((window.end.getTime() - window.start.getTime()) / DAY_MS),
	);
	const daysPast = Math.max(
		0,
		Math.floor((now.getTime() - window.start.getTime()) / DAY_MS),
	);
	return Math.max(0, totalDays - daysPast);
}

/** Whole hours remaining in a daily window (Swift `24 - hoursPast`). */
export function hoursLeftInDay(window: BudgetWindow, now: Date): number {
	const hoursPast = Math.max(
		0,
		Math.floor((now.getTime() - window.start.getTime()) / HOUR_MS),
	);
	return Math.max(0, 24 - hoursPast);
}

export function budgetTimeLeftLabel(
	window: BudgetWindow,
	type: number,
	now: Date,
): string {
	if (type === BUDGET_TYPE.day) {
		return `${hoursLeftInDay(window, now)}h left`;
	}
	return `${daysLeftInWindow(window, now)}d left`;
}

export function leftPerDay(
	leftover: number,
	window: BudgetWindow,
	now: Date,
): number {
	return leftover / Math.max(1, daysLeftInWindow(window, now));
}

export function isBehindPace(
	remaining: number,
	amount: number,
	leftover: number,
): boolean {
	return remaining * amount > leftover;
}

/**
 * The 0.95 ceiling keeps the marker clear of the arc's ends (Swift's
 * `0 < targetPercent < 0.95`).
 */
export function shouldShowPaceMarker(
	type: number,
	remaining: number,
	over: boolean,
): boolean {
	return type !== BUDGET_TYPE.day && !over && remaining > 0 && remaining < 0.95;
}

export interface BudgetRail {
	/** Share of the track the solid fill covers, in [0, 1]. */
	fill: number;
	/** Spending passed the limit: the rail re-scales. */
	over: boolean;
}

/**
 * Over budget the track becomes the spending and the fill is the limit's share
 * of it, so a rail that would otherwise sit empty at every overage instead
 * reports how far past the limit the spending went.
 */
export function budgetRail(spent: number, limit: number): BudgetRail {
	const over = spent > limit;
	if (over) {
		return { fill: clampFill(limit / spent), over };
	}
	// A limit of zero has no track to fill, and would divide to NaN.
	return { fill: limit > 0 ? clampFill(1 - spent / limit) : 0, over };
}

function clampFill(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(1, value));
}
