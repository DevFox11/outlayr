import type { TranslationKey } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import {
	type CalendarSettings,
	DEFAULT_CALENDAR,
	monthAbbrev,
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

/** The start of the period immediately before the one beginning at `start`. */
export function previousPeriodStart(start: Date, type: number): Date {
	switch (type) {
		case BUDGET_TYPE.day:
			return addDays(start, -1);
		case BUDGET_TYPE.week:
			return addDays(start, -7);
		case BUDGET_TYPE.month:
			return addMonthsClamped(start, -1);
		case BUDGET_TYPE.year:
			return addMonthsClamped(start, -12);
		default:
			return new Date(start);
	}
}

/** The window `offset` whole periods from the one at `start`; negative steps back. */
export function shiftWindow(
	start: Date,
	type: number,
	offset: number,
): BudgetWindow {
	let cursor = new Date(start);
	for (let step = 0; step < Math.abs(offset); step += 1) {
		const next =
			offset < 0 ? previousPeriodStart(cursor, type) : periodEnd(cursor, type);
		if (next.getTime() === cursor.getTime()) {
			break;
		}
		cursor = next;
	}
	return { start: cursor, end: periodEnd(cursor, type) };
}

/** 100 years of months, or three of days — far past any window worth browsing. */
const MAX_PERIODS_BACK = 1200;

/**
 * How many whole periods back from `currentStart` still reach `earliest` — the
 * bound on stepping back through closed windows. Ports the Swift stepper's
 * `firstDate` guard: before the oldest entry that could count there is nothing
 * to show, and a budget's own anchor rolls forward, so it cannot be the floor.
 */
export function periodsBackTo(
	currentStart: Date,
	type: number,
	earliest: Date | null,
): number {
	if (!earliest) {
		return 0;
	}
	let steps = 0;
	let start = currentStart;
	while (steps < MAX_PERIODS_BACK && start.getTime() > earliest.getTime()) {
		const previous = previousPeriodStart(start, type);
		if (previous.getTime() >= start.getTime()) {
			break;
		}
		start = previous;
		steps += 1;
	}
	return steps;
}

function dayMonth(date: Date): string {
	return `${date.getDate()} ${monthAbbrev(date)}`;
}

function twoDigitYear(date: Date): string {
	return String(date.getFullYear() % 100).padStart(2, "0");
}

/** Ports the Swift stepper's `dateString`. Ends are exclusive; the label is not. */
export function budgetWindowLabel(window: BudgetWindow, type: number): string {
	if (type === BUDGET_TYPE.day) {
		return `${dayMonth(window.start)} ${window.start.getFullYear()}`;
	}
	const last = addDays(window.end, -1);
	if (type === BUDGET_TYPE.year) {
		return `${dayMonth(window.start)} ${twoDigitYear(window.start)} – ${dayMonth(last)} ${twoDigitYear(last)}`;
	}
	return `${dayMonth(window.start)} – ${dayMonth(last)}`;
}

/**
 * The catalog key for the span a budget covers, not the phrase — the widget
 * payload wants it shouted and the app wants it in a sentence, so casing is the
 * caller's to decide.
 */
export function budgetPeriodPhrase(type: number): TranslationKey {
	switch (type) {
		case BUDGET_TYPE.day:
			return "budgets.period.day";
		case BUDGET_TYPE.week:
			return "budgets.period.week";
		case BUDGET_TYPE.month:
			return "budgets.period.month";
		case BUDGET_TYPE.year:
			return "budgets.period.year";
		default:
			return "budgets.period.other";
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
	t: TranslateFn,
): string {
	if (type === BUDGET_TYPE.day) {
		return t("budgetTime.hoursLeft", { count: hoursLeftInDay(window, now) });
	}
	return t("budgetTime.daysLeft", { count: daysLeftInWindow(window, now) });
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
