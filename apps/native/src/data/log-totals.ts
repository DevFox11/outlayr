import { firstOfMonth, startOfDay, startOfWeek, startOfYear } from "@outlayr/money/calendar";
import { cellFigures } from "@outlayr/money/currency-totals";
import { valueDatedRowsIn } from "@outlayr/money/valuation";
import type { RateTable } from "@outlayr/money/valuation";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import type { LogFigures } from "@/domain/log-measure";

import { logCellQuery, toCurrencyCells } from "./cell-query";
import { useLiveQuery } from "./live-query";

/**
 * Mirrors the Swift `LogPeriod` enum. Kept separate from the Insights period so
 * the two screens can scope independently.
 */
export type LogPeriod = "day" | "week" | "month" | "year" | "all";

export const LOG_PERIOD_ORDER: readonly LogPeriod[] = ["day", "week", "month", "year", "all"];

const STORED = {
    all: 5,
    day: 1,
    month: 3,
    week: 2,
    year: 4,
} satisfies Record<LogPeriod, number>;

export function logPeriodFromStored(value: number): LogPeriod {
    return LOG_PERIOD_ORDER.find((p) => STORED[p] === value) ?? "month";
}

export function storedLogPeriod(period: LogPeriod): number {
    return STORED[period];
}

/** `null` for all-time, which has no lower bound. */
export function logPeriodStart(period: LogPeriod, now: Date, firstWeekday: number): Date | null {
    switch (period) {
        case "day": {
            return startOfDay(now);
        }
        case "week": {
            return startOfWeek(now, firstWeekday);
        }
        case "month": {
            return firstOfMonth(now);
        }
        case "year": {
            return startOfYear(now);
        }
        default: {
            return null;
        }
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
        exchangeRate: transactions.exchangeRate,
        exchangeRateType: transactions.exchangeRateType,
        income: transactions.income,
    };
    const rows = useLiveQuery(
        transactions,
        () => {
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
        },
        [nowMs, enabled, cumulative, floor?.getTime() ?? null],
        nowMs
    );

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
    firstWeekday: number,
    globalCurrency: string,
    rates?: RateTable
): LogInsights {
    const now = new Date(nowMs);
    const start = logPeriodStart(period, now, firstWeekday);

    const rows = useLiveQuery(transactions, () => logCellQuery(db, start, now), [nowMs, period, firstWeekday], nowMs);

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
