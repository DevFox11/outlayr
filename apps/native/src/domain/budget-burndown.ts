import { contributesTo, type ExpenseContribution } from "@/data/budget-spent";
import type { BudgetWindow } from "./budget-math";
import { median } from "./stats";

const DAY_MS = 86_400_000;

/**
 * Fraction of the window that must have elapsed before a projection is offered.
 * A linear extrapolation from two or three days is dominated by whichever
 * transaction happened to land there, so early in a period it lies confidently.
 */
const PROJECTION_FLOOR = 0.2;

export interface BurndownPoint {
	/** `limit - spent`; goes negative once the budget is blown. */
	balance: number;
	/** 1-indexed day within the window. */
	day: number;
	/** Cumulative spend from the window start through the end of this day. */
	spent: number;
}

export interface Burndown {
	/** One point per elapsed day, from the window start through today. */
	points: BurndownPoint[];
	/**
	 * Balance at the window end if the days still to come spend at the median
	 * elapsed daily rate, or null when too little has elapsed to forecast honestly.
	 */
	projectedBalance: number | null;
	runwayDate: Date | null;
	/** 1-indexed day the balance first went negative, or null while it holds. */
	runwayDay: number | null;
	/** Total days the window spans, elapsed or not. */
	totalDays: number;
}

export interface BurndownOptions {
	/** Scope to one category and its subcategories; omit for the overall budget. */
	categoryId?: string | null;
	limit: number;
	now: Date;
	window: BudgetWindow;
}

/** Local midnight, so day arithmetic ignores the clock and any DST shift. */
function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole calendar days from `start` to `date`. Rounding absorbs the ±1h a DST
 * boundary introduces, which a raw `floor(ms / DAY_MS)` would smear into the
 * neighbouring day.
 */
function dayOffset(date: Date, start: Date): number {
	return Math.round((startOfDay(date) - startOfDay(start)) / DAY_MS);
}

/**
 * Expected spend for one day still to come: a typical purchase, times how often
 * purchases happen.
 *
 * A median over the zero-padded calendar instead collapses to 0 for anyone who
 * shops on fewer than half the days — most people, and every per-category
 * budget — and the forecast then claims they will spend nothing ever again.
 */
function dailyRate(perDay: readonly number[]): number {
	const spendDays = perDay.filter((amount) => amount > 0);
	if (spendDays.length === 0) {
		return 0;
	}
	return (median(spendDays) ?? 0) * (spendDays.length / perDay.length);
}

/**
 * Days are bucketed by local calendar date, and the series stops at today:
 * everything past `now` is the projection's job, not the actual line's.
 */
export function buildBurndown(rows: readonly ExpenseContribution[], options: BurndownOptions): Burndown {
	const { limit, window, now, categoryId = null } = options;

	const totalDays = Math.max(1, dayOffset(window.end, window.start));
	const elapsedDays = Math.min(totalDays, Math.max(1, dayOffset(now, window.start) + 1));

	const perDay = new Array<number>(elapsedDays).fill(0);
	for (const row of rows) {
		if (!contributesTo(row, categoryId)) {
			continue;
		}
		const index = dayOffset(row.date, window.start);
		if (index < 0 || index >= elapsedDays) {
			continue;
		}
		perDay[index] += row.amount;
	}

	const points: BurndownPoint[] = [];
	let runwayDay: number | null = null;
	let spent = 0;
	for (let index = 0; index < elapsedDays; index += 1) {
		spent += perDay[index];
		const balance = limit - spent;
		if (runwayDay === null && balance < 0) {
			runwayDay = index + 1;
		}
		points.push({ balance, day: index + 1, spent });
	}

	const elapsedFraction = elapsedDays / totalDays;
	// Spend so far is fact, so only the days still to come are forecast.
	const projectedBalance =
		elapsedFraction >= PROJECTION_FLOOR ? limit - spent - dailyRate(perDay) * (totalDays - elapsedDays) : null;

	return {
		points,
		projectedBalance,
		runwayDate:
			runwayDay === null
				? null
				: new Date(window.start.getFullYear(), window.start.getMonth(), window.start.getDate() + (runwayDay - 1)),
		runwayDay,
		totalDays,
	};
}
