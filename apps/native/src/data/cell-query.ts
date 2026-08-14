import { and, count, eq, gte, isNotNull, isNull, lte, sql, sum } from "drizzle-orm";

import type { SpendDb } from "@/data/budget-spent";
import { transactions } from "@/db/schema";
import type { CurrencyCell } from "@/domain/currency-totals";

/**
 * Deliberately the same key `utcDateString` derives in JS, so a rate looked up
 * here and one looked up for the same row on the Log's day sections resolve to
 * the same day.
 */
export const UTC_DAY = sql<string>`strftime('%Y-%m-%d', ${transactions.date} / 1000, 'unixepoch')`;

/**
 * Any query selecting these must group by `currency`, `income` and
 * {@link UTC_DAY}, or the row it returns is not a cell: conversion needs one
 * currency and one day's rate, and a group spanning either cannot supply them.
 */
export const CELL_COLUMNS = {
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

/**
 * One account's ledger as cells, unbounded by date: a balance is the sum of
 * everything the account ever saw, future-dated entries included.
 */
export function accountCellQuery(db: SpendDb, accountId: string) {
    return db
        .select(CELL_COLUMNS)
        .from(transactions)
        .where(and(isNull(transactions.deletedAt), eq(transactions.accountId, accountId)))
        .groupBy(transactions.currency, transactions.income, UTC_DAY);
}

/**
 * Every attached transaction as cells split by account, unbounded by date —
 * {@link accountCellQuery} for the whole ledger at once, so the accounts
 * overview costs one grouped read rather than one per account.
 */
export function accountsCellQuery(db: SpendDb) {
    return db
        .select({ accountId: transactions.accountId, ...CELL_COLUMNS })
        .from(transactions)
        .where(and(isNull(transactions.deletedAt), isNotNull(transactions.accountId)))
        .groupBy(transactions.accountId, transactions.currency, transactions.income, UTC_DAY);
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
