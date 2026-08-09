import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { cellFigures } from "@/domain/currency-totals";
import { firstOfMonth, startOfDay, startOfWeek, startOfYear } from "@/domain/dates";
import type { LogFigures } from "@/domain/log-measure";
import { type RateTable, valueDatedRowsIn } from "@/domain/valuation";
import { logCellQuery, toCurrencyCells } from "./cell-query";
import { useLiveQuery } from "./live-query";

/**
 * Mirrors the Swift `LogPeriod` enum. Kept separate from the Insights period so
 * the two screens can scope independently.
 */
export type LogPeriod = "day" | "week" | "month" | "year" | "all";

export const LOG_PERIOD_ORDER: readonly LogPeriod[] = ["day", "week", "month", "year", "all"];

const STORED: Record<LogPeriod, number> = {
	all: 5,
	day: 1,
	month: 3,
	week: 2,
	year: 4,
};

export function logPeriodFromStored(value: number): LogPeriod {
	return LOG_PERIOD_ORDER.find((p) => STORED[p] === value) ?? "month";
}

export function storedLogPeriod(period: LogPeriod): number {
	return STORED[period];
}

/**
 * Mid-sentence fragments on purpose: the eyebrow uppercases them and the period
 * menu shows them as-is.
 */
export const LOG_PERIOD_PHRASE: Record<LogPeriod, string> = {
	all: "all time",
	day: "today",
	month: "this month",
	week: "this week",
	year: "this year",
};

export function sentenceCased(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** `null` for all-time, which has no lower bound. */
function periodStart(period: LogPeriod, now: Date): Date | null {
	switch (period) {
		case "day":
			return startOfDay(now);
		case "week":
			return startOfWeek(now);
		case "month":
			return firstOfMonth(now);
		case "year":
			return startOfYear(now);
		case "all":
			return null;
	}
}

/**
 * Net is a running balance from the ledger's first entry, so it needs every row
 * and takes no lower bound. In and Out are per-bucket, so those stop at the
 * window's floor.
 *
 * The valuation arrives as arguments rather than being read here: the screen
 * decides which currency the Log is being read in, and a hook that fetched the
 * global one itself would leave the line in the old currency under an override.
 */
export function useSparklineRows(
	db: Database,
	nowMs: number,
	enabled: boolean,
	cumulative: boolean,
	floor: Date | null,
	displayCurrency: string,
	rates: RateTable
): { date: Date; amount: number; income: boolean }[] {
	const columns = {
		amount: transactions.amount,
		amountUsd: transactions.amountUsd,
		currency: transactions.currency,
		date: transactions.date,
		income: transactions.income,
	};
	const rows = useLiveQuery(transactions, () => {
		if (!enabled) {
			return db.select(columns).from(transactions).where(eq(transactions.id, ""));
		}
		return db
			.select(columns)
			.from(transactions)
			.where(
				and(
					isNull(transactions.deletedAt),
					lte(transactions.date, new Date(nowMs)),
					cumulative || !floor ? undefined : gte(transactions.date, floor)
				)
			)
			.orderBy(asc(transactions.date));
	}, [nowMs, enabled, cumulative, floor?.getTime() ?? null]);

	return useMemo(() => {
		const valued = valueDatedRowsIn(rows, displayCurrency, rates);
		return rows.map((row, index) => ({
			amount: valued[index],
			date: row.date,
			income: row.income,
		}));
	}, [rows, displayCurrency, rates]);
}

/**
 * With rates on hand a mixed-currency period reads as one bucket; without them,
 * or for entries no rate can reach, each currency keeps its own — a sum across
 * currencies is never invented.
 */
export interface LogInsights {
	/** Never absent: an empty period yields zeroes in the global currency. */
	dominant: LogFigures;
	/** Every other currency the period used, in dominance order. */
	others: LogFigures[];
	/** Dominant first, then the rest. */
	perCurrency: LogFigures[];
}

/**
 * Only the header scopes to the period — the list below stays full. `nowMs` is
 * a dependency so the upper "future rows hidden" boundary only moves when the
 * caller intends.
 */
export function useLogInsights(
	db: Database,
	nowMs: number,
	period: LogPeriod,
	globalCurrency: string,
	rates?: RateTable
): LogInsights {
	const now = new Date(nowMs);
	const start = periodStart(period, now);

	const rows = useLiveQuery(transactions, () => logCellQuery(db, start, now), [nowMs, period]);

	return useMemo(() => {
		const ordered = cellFigures(toCurrencyCells(rows), globalCurrency, rates);

		const dominant = ordered[0] ?? {
			count: 0,
			currencyCode: globalCurrency,
			expense: 0,
			income: 0,
		};
		const others = ordered.slice(1);

		return {
			dominant,
			others,
			perCurrency: [dominant, ...others],
		};
	}, [rows, globalCurrency, rates]);
}
