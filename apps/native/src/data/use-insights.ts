import { and, gte, isNull, lte, min } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { valueDatedRowsIn } from "@/domain/valuation";
import { useLanguage } from "@/i18n/context";
import {
	bucketSeries,
	type CategoryBreakdownEntry,
	type CategoryMeta,
	type CategoryMover,
	categoryBreakdown,
	categoryMovers,
	DEFAULT_INSIGHTS_CALENDAR,
	elapsedSlots,
	type InsightsBucket,
	type InsightsCalendar,
	type InsightsContribution,
	type InsightsMeasure,
	type InsightsPeriod,
	offsetForDate,
	periodTotal,
	windowEnd,
	windowLabel,
	windowShortLabel,
	windowStart,
	windowTotals,
	withCategoryDeltas,
} from "./insights";
import { useLiveQuery } from "./live-query";
import { useValuation } from "./use-valuation";

export interface UseInsightsResult {
	/** True at offset 0, where the pager cannot step newer. */
	atCurrent: boolean;
	/** True once the window reaches the earliest transaction's period. */
	atEarliest: boolean;
	/** Each entry carries its vs-prior delta. */
	breakdown: CategoryBreakdownEntry[];
	buckets: InsightsBucket[];
	categoriesById: Map<string, CategoryMeta>;
	end: Date;
	/**
	 * Whether the ledger holds anything at all. The empty state turns on this and
	 * not on the window being empty.
	 */
	hasHistory: boolean;
	income: number;
	label: string;
	/** Mean over the window's *elapsed* slots. Signed. */
	measureAverage: number;
	/** Empty when there is no prior window to compare against. */
	movers: CategoryMover[];
	/** Signed: `income − spent`. */
	net: number;
	/** `|net|` over the elapsed slots. */
	netAverage: number;
	nextLabel: string;
	prevLabel: string;
	priorLabel: string;
	/** Magnitude for the *selected* measure. */
	priorMeasure: number;
	priorNet: number;
	rows: InsightsContribution[];
	spent: number;
	start: Date;
	total: number;
}

export function useInsights(
	db: Database,
	nowMs: number,
	period: InsightsPeriod,
	measure: InsightsMeasure,
	offset = 0,
	calendar: InsightsCalendar = DEFAULT_INSIGHTS_CALENDAR
): UseInsightsResult {
	const { firstWeekday, firstDayOfMonth } = calendar;
	// Threaded through every label below rather than left to the `runtimeLanguage()`
	// default: the labels are built inside a memo, so a default read makes them
	// look reactive while they hold last language's month names until an unrelated
	// dependency happens to move.
	const { language } = useLanguage();

	// The analysed window plus the one before it, which `windowTotals` needs for
	// the vs-prior badge. Bounding here keeps this off a full-history scan.
	const queryStart = useMemo(
		() =>
			windowStart(period, new Date(nowMs), offset - 1, {
				firstDayOfMonth,
				firstWeekday,
			}),
		[period, nowMs, offset, firstWeekday, firstDayOfMonth]
	);

	const txData = useLiveQuery(
		transactions,
		() =>
			db
				.select({
					amount: transactions.amount,
					amountUsd: transactions.amountUsd,
					categoryId: transactions.categoryId,
					currency: transactions.currency,
					date: transactions.date,
					income: transactions.income,
				})
				.from(transactions)
				.where(
					and(
						isNull(transactions.deletedAt),
						gte(transactions.date, queryStart),
						lte(transactions.date, new Date(nowMs))
					)
				),
		[nowMs, queryStart.getTime()]
	);

	// How far back the pager may step. Derived from its own aggregate row because
	// the loaded set is only two windows wide and does not know where the user's
	// history begins.
	const earliestData = useLiveQuery(transactions, () =>
		db
			.select({ earliest: min(transactions.date) })
			.from(transactions)
			.where(isNull(transactions.deletedAt))
	);

	const catData = useLiveQuery(categories, () => db.select().from(categories).where(isNull(categories.deletedAt)));

	const { displayCurrency, rates } = useValuation(db);

	return useMemo(() => {
		const cal: InsightsCalendar = { firstDayOfMonth, firstWeekday };
		const categoriesById = new Map<string, CategoryMeta>();
		for (const category of catData) {
			categoriesById.set(category.id, {
				color: category.color,
				emoji: category.emoji,
				icon: category.icon,
				id: category.id,
				income: category.income,
				name: category.name,
				parentId: category.parentId,
			});
		}
		// parentId is read from this map rather than joined onto the transaction
		// query: `useLiveQuery` only invalidates on the table it watches, so a joined
		// parentId survives a re-parent and silently buckets the spend under the old
		// parent. The category subscription above does invalidate.
		const valued = valueDatedRowsIn(txData, displayCurrency, rates);
		const rows: InsightsContribution[] = txData.map((row, index) => ({
			// `amount` is the valued amount from here down, not the row's stored one.
			amount: valued[index],
			categoryId: row.categoryId,
			date: row.date,
			income: row.income,
			parentId: row.categoryId ? (categoriesById.get(row.categoryId)?.parentId ?? null) : null,
		}));
		const now = new Date(nowMs);
		const buckets = bucketSeries(rows, period, measure, now, offset, cal, language);
		const total = periodTotal(buckets);
		const { income, spent } = windowTotals(rows, period, now, offset, cal);
		const prior = windowTotals(rows, period, now, offset - 1, cal);
		const net = income - spent;
		const divisor = elapsedSlots(period, now, offset, cal);

		// SQLite hands `min()` back as the stored integer (timestamp_ms) or null on
		// an empty table.
		const earliestRaw = earliestData[0]?.earliest ?? null;
		const earliest = earliestRaw == null ? null : new Date(Number(earliestRaw));
		const minOffset = earliest ? Math.min(0, offsetForDate(period, earliest, now, cal)) : 0;

		const composition = categoryBreakdown(rows, categoriesById, period, measure, now, offset, cal);
		const priorComposition = categoryBreakdown(rows, categoriesById, period, measure, now, offset - 1, cal);
		// The breakdown's own total, so the movers' floor and the rows' shares
		// share a denominator.
		let compositionTotal = 0;
		for (const item of composition) {
			compositionTotal += item.amount;
		}

		return {
			atCurrent: offset >= 0,
			atEarliest: offset <= minOffset,
			breakdown: withCategoryDeltas(composition, priorComposition),
			buckets,
			categoriesById,
			end: windowEnd(period, now, offset, cal),
			hasHistory: earliest != null,
			income,
			label: windowLabel(period, offset, now, cal, language),
			measureAverage: total / divisor,
			movers: categoryMovers(composition, priorComposition, compositionTotal),
			net,
			netAverage: Math.abs(net) / divisor,
			nextLabel: windowShortLabel(period, offset + 1, now, cal, language),
			prevLabel: windowShortLabel(period, offset - 1, now, cal, language),
			priorLabel: windowLabel(period, offset - 1, now, cal, language),
			priorMeasure: measure === "income" ? prior.income : prior.spent,
			priorNet: prior.income - prior.spent,
			rows,
			spent,
			start: windowStart(period, now, offset, cal),
			total,
		};
	}, [
		txData,
		catData,
		earliestData,
		displayCurrency,
		rates,
		nowMs,
		period,
		measure,
		offset,
		firstWeekday,
		firstDayOfMonth,
		language,
	]);
}
