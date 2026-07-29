import { and, eq, isNull, lte } from "drizzle-orm";
import { categories, transactions } from "@/db/schema";
import {
	addDays,
	addMonths,
	type CalendarSettings,
	DEFAULT_CALENDAR,
	monthAbbrev,
	monthPeriodStart,
	startOfWeek,
	startOfYear,
	weekdayInitial,
} from "@/domain/dates";
import { valueDatedRowsIn } from "@/domain/valuation";
import type { SpendDb } from "./budget-spent";
import { NO_VALUATION, type Valuation } from "./valuation-source";

/** Mirrors the Swift `ChartTimeFrame`. */
export type InsightsPeriod = "week" | "month" | "year";

/** Mirrors the Swift `LogMeasure`. */
export type InsightsMeasure = "spent" | "income" | "net";

const FALLBACK_CATEGORY_COLOR = "#767676";

const DAY_MS = 86_400_000;

export { monthPeriodStart };

export type InsightsCalendar = CalendarSettings;

export const DEFAULT_INSIGHTS_CALENDAR: InsightsCalendar = DEFAULT_CALENDAR;

/** Already filtered to non-deleted rows dated on or before now. */
export interface InsightsContribution {
	amount: number;
	income: boolean;
	categoryId: string | null;
	parentId: string | null;
	date: Date;
}

export interface CategoryMeta {
	id: string;
	name: string | null;
	color: string | null;
	icon: string | null;
	emoji: string | null;
	income: boolean;
	parentId: string | null;
}

export interface InsightsBucket {
	start: Date;
	/** Exclusive. */
	end: Date;
	label: string;
	/** Signed for `net` (income − expense); a positive magnitude otherwise. */
	value: number;
}

interface BucketRange {
	start: Date;
	end: Date;
	label: string;
}

const MONTHS_TITLE = [
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
] as const;

/**
 * Windows are calendar-anchored, not trailing: a week runs from its
 * `firstWeekday`, a month from its `firstDayOfMonth`, a year from January.
 */
export function windowStart(
	period: InsightsPeriod,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): Date {
	if (period === "week") {
		return addDays(startOfWeek(now, calendar.firstWeekday), offset * 7);
	}
	if (period === "month") {
		return addMonths(monthPeriodStart(now, calendar.firstDayOfMonth), offset);
	}
	const start = startOfYear(now);
	start.setFullYear(start.getFullYear() + offset);
	return start;
}

/** Exclusive. */
export function windowEnd(
	period: InsightsPeriod,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): Date {
	return windowStart(period, now, offset + 1, calendar);
}

/**
 * Oldest first. Every slot is present even when it is still in the future — the
 * chart dims those rather than omitting them.
 */
export function bucketRanges(
	period: InsightsPeriod,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): BucketRange[] {
	const start = windowStart(period, now, offset, calendar);
	const ranges: BucketRange[] = [];
	if (period === "year") {
		for (let i = 0; i < 12; i++) {
			const slot = addMonths(start, i);
			ranges.push({
				start: slot,
				end: addMonths(slot, 1),
				label: monthAbbrev(slot),
			});
		}
		return ranges;
	}
	const end = windowEnd(period, now, offset, calendar);
	const slots =
		period === "week"
			? 7
			: Math.round((end.getTime() - start.getTime()) / DAY_MS);
	for (let i = 0; i < slots; i++) {
		const slot = addDays(start, i);
		ranges.push({
			start: slot,
			end: addDays(slot, 1),
			label: period === "week" ? weekdayInitial(slot) : String(slot.getDate()),
		});
	}
	return ranges;
}

/** The divisor behind every "per day" / "per month" figure. */
export function elapsedSlots(
	period: InsightsPeriod,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): number {
	const ranges = bucketRanges(period, now, offset, calendar);
	if (ranges.length === 0) {
		return 1;
	}
	const nowMs = now.getTime();
	let elapsed = 0;
	for (const range of ranges) {
		if (range.start.getTime() <= nowMs) {
			elapsed++;
		}
	}
	return Math.max(1, Math.min(ranges.length, elapsed));
}

function measureValue(
	income: boolean,
	amount: number,
	measure: InsightsMeasure,
): number {
	switch (measure) {
		case "spent":
			return income ? 0 : amount;
		case "income":
			return income ? amount : 0;
		case "net":
			return income ? amount : -amount;
	}
}

/** Future rows (`date > now`) are dropped. */
export function bucketSeries(
	rows: readonly InsightsContribution[],
	period: InsightsPeriod,
	measure: InsightsMeasure,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): InsightsBucket[] {
	const nowMs = now.getTime();
	const buckets: InsightsBucket[] = bucketRanges(
		period,
		now,
		offset,
		calendar,
	).map((r) => ({ ...r, value: 0 }));
	if (buckets.length === 0) {
		return buckets;
	}
	const start = buckets[0].start.getTime();
	const end = buckets[buckets.length - 1].end.getTime();
	for (const row of rows) {
		const t = row.date.getTime();
		if (t > nowMs || t < start || t >= end) {
			continue;
		}
		const value = measureValue(row.income, row.amount, measure);
		if (value === 0) {
			continue;
		}
		for (const bucket of buckets) {
			if (t >= bucket.start.getTime() && t < bucket.end.getTime()) {
				bucket.value += value;
				break;
			}
		}
	}
	return buckets;
}

/** What `net` is charted as, rather than the per-slot flow. */
export function runningTotals(buckets: readonly InsightsBucket[]): number[] {
	const totals: number[] = [];
	let carried = 0;
	for (const bucket of buckets) {
		carried += bucket.value;
		totals.push(carried);
	}
	return totals;
}

export function periodTotal(buckets: readonly InsightsBucket[]): number {
	let total = 0;
	for (const bucket of buckets) {
		total += bucket.value;
	}
	return total;
}

function windowBounds(
	period: InsightsPeriod,
	now: Date,
	offset: number,
	calendar: InsightsCalendar,
): { start: number; end: number } | null {
	const ranges = bucketRanges(period, now, offset, calendar);
	if (ranges.length === 0) {
		return null;
	}
	return {
		start: ranges[0].start.getTime(),
		end: ranges[ranges.length - 1].end.getTime(),
	};
}

/** `income` reads inflows; `spent` and `net` both read the outflow composition. */
export function categoryBreakdown(
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	period: InsightsPeriod,
	measure: InsightsMeasure,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): CategoryBreakdownEntry[] {
	const bounds = windowBounds(period, now, offset, calendar);
	if (!bounds) {
		return [];
	}
	return categoryBreakdownWithin(rows, categoriesById, measure, bounds, now);
}

export function categoryBreakdownWithin(
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	measure: InsightsMeasure,
	bounds: { start: number; end: number },
	now: Date,
): CategoryBreakdownEntry[] {
	const wantIncome = measure === "income";
	const nowMs = now.getTime();
	const sums = new Map<string, number>();
	for (const row of rows) {
		if (row.income !== wantIncome) {
			continue;
		}
		const t = row.date.getTime();
		if (t > nowMs || t < bounds.start || t >= bounds.end) {
			continue;
		}
		const topId = row.parentId ?? row.categoryId;
		if (topId == null) {
			continue;
		}
		sums.set(topId, (sums.get(topId) ?? 0) + row.amount);
	}
	let total = 0;
	for (const amount of sums.values()) {
		total += amount;
	}
	const entries: CategoryBreakdownEntry[] = [];
	for (const [id, amount] of sums) {
		const meta = categoriesById.get(id);
		entries.push({
			id,
			name: meta?.name ?? "Uncategorized",
			color: meta?.color ?? FALLBACK_CATEGORY_COLOR,
			icon: meta?.icon ?? null,
			emoji: meta?.emoji ?? null,
			amount,
			fraction: total > 0 ? amount / total : 0,
			delta: null,
		});
	}
	entries.sort((a, b) => b.amount - a.amount);
	return entries;
}

export interface CategoryBreakdownEntry {
	/** Top-level category id. */
	id: string;
	name: string;
	color: string;
	icon: string | null;
	emoji: string | null;
	/** Positive magnitude summed across the category and its subcategories. */
	amount: number;
	/** `amount` ÷ breakdown total, in [0, 1]. */
	fraction: number;
	/**
	 * Change against the same window one period earlier, as a fraction of the
	 * prior amount; null when there is no prior amount to compare against.
	 * Filled by {@link withCategoryDeltas}, not by the breakdown itself.
	 */
	delta: number | null;
}

export function withCategoryDeltas(
	current: readonly CategoryBreakdownEntry[],
	prior: readonly CategoryBreakdownEntry[],
): CategoryBreakdownEntry[] {
	const priorById = new Map(prior.map((entry) => [entry.id, entry.amount]));
	return current.map((entry) => {
		const before = priorById.get(entry.id);
		return {
			...entry,
			delta:
				before != null && before > 0 ? (entry.amount - before) / before : null,
		};
	});
}

export interface CategoryMover {
	id: string;
	name: string;
	color: string;
	icon: string | null;
	emoji: string | null;
	/** Signed change in currency. Positive means more flowed this window. */
	delta: number;
	/** `delta` ÷ the prior amount, or null for a category that is simply new. */
	fraction: number | null;
}

const MOVER_MIN_SHARE = 0.05;
const MOVER_LIMIT = 3;

/** Ranked and gated on currency, not percentage. */
export function categoryMovers(
	current: readonly CategoryBreakdownEntry[],
	prior: readonly CategoryBreakdownEntry[],
	windowTotal: number,
): CategoryMover[] {
	if (prior.length === 0 || windowTotal <= 0) {
		return [];
	}

	const floor = windowTotal * MOVER_MIN_SHARE;
	const priorById = new Map(prior.map((entry) => [entry.id, entry]));
	const movers: CategoryMover[] = [];

	for (const entry of current) {
		const before = priorById.get(entry.id);
		const delta = entry.amount - (before?.amount ?? 0);
		if (Math.abs(delta) < floor) {
			continue;
		}
		movers.push({
			id: entry.id,
			name: entry.name,
			color: entry.color,
			icon: entry.icon,
			emoji: entry.emoji,
			delta,
			fraction:
				before != null && before.amount > 0 ? delta / before.amount : null,
		});
	}

	// A category that stopped entirely cannot be found by walking the current
	// window, which no longer has it.
	const currentIds = new Set(current.map((entry) => entry.id));
	for (const entry of prior) {
		if (currentIds.has(entry.id) || entry.amount < floor) {
			continue;
		}
		movers.push({
			id: entry.id,
			name: entry.name,
			color: entry.color,
			icon: entry.icon,
			emoji: entry.emoji,
			delta: -entry.amount,
			fraction: -1,
		});
	}

	movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
	return movers.slice(0, MOVER_LIMIT);
}

/** Both totals are positive magnitudes; the net is `income − spent`. */
export function windowTotals(
	rows: readonly InsightsContribution[],
	period: InsightsPeriod,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): { income: number; spent: number } {
	const bounds = windowBounds(period, now, offset, calendar);
	if (!bounds) {
		return { income: 0, spent: 0 };
	}
	const nowMs = now.getTime();
	let income = 0;
	let spent = 0;
	for (const row of rows) {
		const t = row.date.getTime();
		if (t > nowMs || t < bounds.start || t >= bounds.end) {
			continue;
		}
		if (row.income) {
			income += row.amount;
		} else {
			spent += row.amount;
		}
	}
	return { income, spent };
}

/**
 * Includes a "Direct" entry, keyed on `parentId` itself, for transactions filed
 * on the parent rather than a child. Mirrors the Swift
 * `HorizontalPieChartView.childrenBreakdown`.
 */
export function subcategoryBreakdown(
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	parentId: string,
	period: InsightsPeriod,
	measure: InsightsMeasure,
	now: Date,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): CategoryBreakdownEntry[] {
	const bounds = windowBounds(period, now, offset, calendar);
	if (!bounds) {
		return [];
	}
	return subcategoryBreakdownWithin(
		rows,
		categoriesById,
		parentId,
		measure,
		bounds,
		now,
	);
}

export function subcategoryBreakdownWithin(
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	parentId: string,
	measure: InsightsMeasure,
	bounds: { start: number; end: number },
	now: Date,
): CategoryBreakdownEntry[] {
	const wantIncome = measure === "income";
	const nowMs = now.getTime();
	const sums = new Map<string, number>();
	for (const row of rows) {
		if (row.income !== wantIncome) {
			continue;
		}
		const t = row.date.getTime();
		if (t > nowMs || t < bounds.start || t >= bounds.end) {
			continue;
		}
		if ((row.parentId ?? row.categoryId) !== parentId) {
			continue;
		}
		const key = row.categoryId ?? parentId;
		sums.set(key, (sums.get(key) ?? 0) + row.amount);
	}
	let total = 0;
	for (const amount of sums.values()) {
		total += amount;
	}
	const parentMeta = categoriesById.get(parentId);
	const entries: CategoryBreakdownEntry[] = [];
	for (const [key, amount] of sums) {
		const direct = key === parentId;
		const meta = categoriesById.get(key);
		entries.push({
			id: key,
			name: direct ? "Direct" : (meta?.name ?? "Uncategorized"),
			color:
				(direct ? parentMeta?.color : meta?.color) ?? FALLBACK_CATEGORY_COLOR,
			icon: (direct ? parentMeta?.icon : meta?.icon) ?? null,
			emoji: (direct ? parentMeta?.emoji : meta?.emoji) ?? null,
			amount,
			fraction: total > 0 ? amount / total : 0,
			delta: null,
		});
	}
	entries.sort((a, b) => b.amount - a.amount);
	return entries;
}

/** 0 is the current window; negative offsets are the past. */
export function offsetForDate(
	period: InsightsPeriod,
	target: Date,
	now: Date,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): number {
	if (period === "week") {
		const from = startOfWeek(now, calendar.firstWeekday).getTime();
		const to = startOfWeek(target, calendar.firstWeekday).getTime();
		return Math.round((to - from) / (7 * DAY_MS));
	}
	if (period === "month") {
		const from = monthPeriodStart(now, calendar.firstDayOfMonth);
		const to = monthPeriodStart(target, calendar.firstDayOfMonth);
		return (
			(to.getFullYear() - from.getFullYear()) * 12 +
			(to.getMonth() - from.getMonth())
		);
	}
	return target.getFullYear() - now.getFullYear();
}

function dayMonth(date: Date): string {
	return `${date.getDate()} ${MONTHS_TITLE[date.getMonth()]}`;
}

/**
 * Matches `SingleGraphView.dateString`: "9 - 15 Jul" (or "29 Jun - 5 Jul"
 * across a month boundary), "Jul 2025", "2025".
 */
export function windowLabel(
	period: InsightsPeriod,
	offset: number,
	now: Date,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): string {
	const start = windowStart(period, now, offset, calendar);
	if (period === "week") {
		const end = addDays(start, 6);
		if (start.getMonth() === end.getMonth()) {
			return `${start.getDate()} - ${dayMonth(end)}`;
		}
		return `${dayMonth(start)} - ${dayMonth(end)}`;
	}
	if (period === "month") {
		if (calendar.firstDayOfMonth === 1) {
			return `${MONTHS_TITLE[start.getMonth()]} ${start.getFullYear()}`;
		}
		return `${dayMonth(start)} - ${dayMonth(addDays(windowEnd(period, now, offset, calendar), -1))}`;
	}
	return String(start.getFullYear());
}

/** Swift `PagedGraphView` formats: "8 Jul", "Jun 25", "2024". */
export function windowShortLabel(
	period: InsightsPeriod,
	offset: number,
	now: Date,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR,
): string {
	const start = windowStart(period, now, offset, calendar);
	if (period === "week") {
		return dayMonth(start);
	}
	if (period === "month") {
		return `${MONTHS_TITLE[start.getMonth()]} ${String(start.getFullYear()).slice(-2)}`;
	}
	return String(start.getFullYear());
}

/** "12 Jul 2025" for a day, "Jul 2025" for a month. */
export function bucketDateLabel(period: InsightsPeriod, date: Date): string {
	if (period === "year") {
		return `${MONTHS_TITLE[date.getMonth()]} ${date.getFullYear()}`;
	}
	return `${dayMonth(date)} ${date.getFullYear()}`;
}

/**
 * The reactive hook builds this same query itself; this async form feeds the
 * tests, so the two have to stay in step.
 */
export async function loadContributions(
	db: SpendDb,
	now: Date,
	valuation: Valuation = NO_VALUATION,
): Promise<InsightsContribution[]> {
	const rows = await db
		.select({
			amount: transactions.amount,
			income: transactions.income,
			date: transactions.date,
			categoryId: transactions.categoryId,
			parentId: categories.parentId,
			currency: transactions.currency,
			amountUsd: transactions.amountUsd,
		})
		.from(transactions)
		.leftJoin(categories, eq(transactions.categoryId, categories.id))
		.where(and(isNull(transactions.deletedAt), lte(transactions.date, now)));
	const valued = valueDatedRowsIn(
		rows,
		valuation.displayCurrency,
		valuation.rates,
	);
	return rows.map((row, index) => ({
		// `amount` is the valued amount from here down, not the row's stored one.
		amount: valued[index],
		income: row.income,
		categoryId: row.categoryId,
		parentId: row.parentId ?? null,
		date: row.date,
	}));
}
