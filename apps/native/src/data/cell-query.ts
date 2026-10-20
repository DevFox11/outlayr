import type { CurrencyCell } from "@outlayr/money/currency-totals";
import { and, count, eq, gte, isNotNull, isNull, lte, sql, sum } from "drizzle-orm";

import type { SpendDb } from "@/data/budget-spent";
import { transactions } from "@/db/schema";

/**
 * Deliberately the same key `utcDateString` derives in JS, so a rate looked up
 * here and one looked up for the same row on the Log's day sections resolve to
 * the same day.
 */
export const UTC_DAY = sql<string>`strftime('%Y-%m-%d', ${transactions.date} / 1000, 'unixepoch')`;

/**
 * Where a row is PLOTTED, on the reader's calendar. Never where it is VALUED.
 *
 * A goal is measured in local days throughout — `useNow` ticks at local midnight
 * and the picker hands back one — so its history has to be bucketed on them, or
 * a Friday evening entry lands in Saturday's bucket and is drawn before itself.
 *
 * It travels beside `dateKey` rather than replacing it: that key is the date the
 * rate is looked up at, so re-cutting it would value a row on a day whose rate
 * may not exist, or may not be the one it was frozen against.
 *
 * Every read of an account's cells groups by it, plotted or not: each cell is
 * rounded on its own when valued, so two reads that split a UTC day differently
 * value the account a cent apart.
 */
export const LOCAL_DAY = sql<string>`strftime('%Y-%m-%d', ${transactions.date} / 1000, 'unixepoch', 'localtime')`;

/**
 * Any query selecting these must group by `currency`, `income` and
 * {@link UTC_DAY}, or the row it returns is not a cell: conversion needs one
 * currency and one day's rate, and a group spanning either cannot supply them.
 */
const CELL_COLUMNS = {
    currency: transactions.currency,
    dateKey: UTC_DAY,
    income: transactions.income,
    rateNeeded: sum(
        sql<number>`CASE WHEN ${transactions.exchangeRateType} = 'custom' AND ${transactions.exchangeRate} IS NULL AND ${transactions.amountUsd} IS NULL THEN ${transactions.amount} ELSE 0 END`
    ),
    rateNeededRows: sql<number>`SUM(CASE WHEN ${transactions.exchangeRateType} = 'custom' AND ${transactions.exchangeRate} IS NULL AND ${transactions.amountUsd} IS NULL THEN 1 ELSE 0 END)`,
    rows: count(),
    total: sum(transactions.amount),
    totalUsd: sum(transactions.amountUsd),
    // The part of `total` no rate can be applied to, since a row with no frozen
    // USD value contributes nothing to `totalUsd`.
    unconverted: sum(sql<number>`CASE WHEN ${transactions.amountUsd} IS NULL THEN ${transactions.amount} ELSE 0 END`),
    unconvertedRows: sql<number>`SUM(CASE WHEN ${transactions.amountUsd} IS NULL THEN 1 ELSE 0 END)`,
} as const;

export interface CellRow {
    currency: string | null;
    dateKey: string;
    income: boolean;
    rateNeeded?: string | number | null;
    rateNeededRows?: string | number | null;
    rows: number;
    // SQLite hands an aggregate back as a string through drizzle when the column
    // is real, and as a number when it is integer.
    total: string | number | null;
    totalUsd: string | number | null;
    unconverted: string | number | null;
    unconvertedRows: string | number | null;
}

export function toCurrencyCell(row: CellRow): CurrencyCell {
    // A sum is null when the group matched no rows.
    return {
        amount: Number(row.total ?? 0),
        amountUsd: Number(row.totalUsd ?? 0),
        count: row.rows,
        currencyCode: row.currency,
        dateKey: row.dateKey,
        income: row.income,
        rateNeededAmount: Number(row.rateNeeded ?? 0),
        rateNeededCount: Number(row.rateNeededRows ?? 0),
        unconvertedAmount: Number(row.unconverted ?? 0),
        unconvertedCount: Number(row.unconvertedRows ?? 0),
    };
}

export function toCurrencyCells(rows: readonly CellRow[]): CurrencyCell[] {
    return rows.map(toCurrencyCell);
}

/**
 * Aggregated in SQL, not by pulling the window into JS: the Log's `"all"`
 * period has no lower bound, so a plain `select()` would fetch every column of
 * every transaction ever on each of this subscription's many re-runs.
 */
export function logCellQuery(db: SpendDb, start: Date | null, now: Date) {
    return db
        .select(CELL_COLUMNS)
        .from(transactions)
        .where(
            and(
                isNull(transactions.deletedAt),
                start ? gte(transactions.date, start) : undefined,
                lte(transactions.date, now)
            )
        )
        .groupBy(transactions.currency, transactions.income, UTC_DAY);
}

export function settledAccountCellQuery(db: SpendDb, accountId: string, now: Date) {
    return db
        .select({ ...CELL_COLUMNS, plotDay: LOCAL_DAY })
        .from(transactions)
        .where(and(isNull(transactions.deletedAt), eq(transactions.accountId, accountId), lte(transactions.date, now)))
        .groupBy(transactions.currency, transactions.income, UTC_DAY, LOCAL_DAY);
}

/**
 * A balance is what has happened SO FAR, so it cannot count money dated
 * later. Filtering the cells afterwards is not equivalent: a cell carries only a
 * `YYYY-MM-DD` key, so an entry scheduled for 23:00 today is indistinguishable
 * from one already made at 09:00. The bound has to be applied to the rows before
 * they are grouped, which is what this does.
 */
export function settledAccountsCellQuery(db: SpendDb, now: Date) {
    return db
        .select({ accountId: transactions.accountId, ...CELL_COLUMNS, plotDay: LOCAL_DAY })
        .from(transactions)
        .where(and(isNull(transactions.deletedAt), isNotNull(transactions.accountId), lte(transactions.date, now)))
        .groupBy(transactions.accountId, transactions.currency, transactions.income, UTC_DAY, LOCAL_DAY);
}

/**
 * Split by category and unbounded by date — Swift's
 * `Category.allTransactions` reduction, which counts a future-dated log too.
 */
export function categoryCellQuery(db: SpendDb) {
    return db
        .select({ categoryId: transactions.categoryId, ...CELL_COLUMNS })
        .from(transactions)
        .where(isNull(transactions.deletedAt))
        .groupBy(transactions.categoryId, transactions.currency, transactions.income, UTC_DAY);
}
