import { and, count, eq, isNull, lte, sql, sum } from "drizzle-orm";

import type { SpendDb } from "@/data/budget-spent";
import { transfers } from "@/db/schema";
import type { CurrencyCell } from "@/domain/currency-totals";

import type { CellRow } from "./cell-query";

const TRANSFER_UTC_DAY = sql<string>`strftime('%Y-%m-%d', ${transfers.date} / 1000, 'unixepoch')`;

/** Where a transfer leg is PLOTTED, never where it is valued — see `LOCAL_DAY`. */
const TRANSFER_LOCAL_DAY = sql<string>`strftime('%Y-%m-%d', ${transfers.date} / 1000, 'unixepoch', 'localtime')`;

/**
 * `income` is absent from both column sets on purpose: a transfer row has no
 * direction of its own. Direction is which side of the row you are reading it
 * from, so it is stamped on in {@link toTransferCell} rather than selected.
 */
const OUTBOUND_COLUMNS = {
    currency: transfers.fromCurrency,
    dateKey: TRANSFER_UTC_DAY,
    rows: count(),
    total: sum(transfers.fromAmount),
    totalUsd: sum(transfers.fromAmountUsd),
    unconverted: sum(sql<number>`CASE WHEN ${transfers.fromAmountUsd} IS NULL THEN ${transfers.fromAmount} ELSE 0 END`),
    unconvertedRows: sql<number>`SUM(CASE WHEN ${transfers.fromAmountUsd} IS NULL THEN 1 ELSE 0 END)`,
} as const;

const INBOUND_COLUMNS = {
    currency: transfers.toCurrency,
    dateKey: TRANSFER_UTC_DAY,
    rows: count(),
    total: sum(transfers.toAmount),
    totalUsd: sum(transfers.toAmountUsd),
    unconverted: sum(sql<number>`CASE WHEN ${transfers.toAmountUsd} IS NULL THEN ${transfers.toAmount} ELSE 0 END`),
    unconvertedRows: sql<number>`SUM(CASE WHEN ${transfers.toAmountUsd} IS NULL THEN 1 ELSE 0 END)`,
} as const;

export function transferOutboundQuery(db: SpendDb, accountId: string) {
    return db
        .select(OUTBOUND_COLUMNS)
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), eq(transfers.fromAccountId, accountId)))
        .groupBy(transfers.fromCurrency, TRANSFER_UTC_DAY);
}

export function transferInboundQuery(db: SpendDb, accountId: string) {
    return db
        .select(INBOUND_COLUMNS)
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), eq(transfers.toAccountId, accountId)))
        .groupBy(transfers.toCurrency, TRANSFER_UTC_DAY);
}

export function transfersOutboundQuery(db: SpendDb) {
    return db
        .select({ accountId: transfers.fromAccountId, ...OUTBOUND_COLUMNS })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.fromAccountId, transfers.fromCurrency, TRANSFER_UTC_DAY);
}

/** Single-account settled legs, for a chart that draws one account's history. */
export function settledTransferOutboundQuery(db: SpendDb, accountId: string, now: Date) {
    return db
        .select({ ...OUTBOUND_COLUMNS, plotDay: TRANSFER_LOCAL_DAY })
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), eq(transfers.fromAccountId, accountId), lte(transfers.date, now)))
        .groupBy(transfers.fromCurrency, TRANSFER_UTC_DAY, TRANSFER_LOCAL_DAY);
}

export function settledTransferInboundQuery(db: SpendDb, accountId: string, now: Date) {
    return db
        .select({ ...INBOUND_COLUMNS, plotDay: TRANSFER_LOCAL_DAY })
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), eq(transfers.toAccountId, accountId), lte(transfers.date, now)))
        .groupBy(transfers.toCurrency, TRANSFER_UTC_DAY, TRANSFER_LOCAL_DAY);
}

/**
 * {@link transfersOutboundQuery} and {@link transfersInboundQuery} bounded at
 * `now` by the row's own timestamp — see `settledAccountsCellQuery` for why the
 * bound cannot be applied to the cells afterwards.
 */
export function settledTransfersOutboundQuery(db: SpendDb, now: Date) {
    return db
        .select({ accountId: transfers.fromAccountId, ...OUTBOUND_COLUMNS })
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), lte(transfers.date, now)))
        .groupBy(transfers.fromAccountId, transfers.fromCurrency, TRANSFER_UTC_DAY);
}

export function settledTransfersInboundQuery(db: SpendDb, now: Date) {
    return db
        .select({ accountId: transfers.toAccountId, ...INBOUND_COLUMNS })
        .from(transfers)
        .where(and(isNull(transfers.deletedAt), lte(transfers.date, now)))
        .groupBy(transfers.toAccountId, transfers.toCurrency, TRANSFER_UTC_DAY);
}

export function transfersInboundQuery(db: SpendDb) {
    return db
        .select({ accountId: transfers.toAccountId, ...INBOUND_COLUMNS })
        .from(transfers)
        .where(isNull(transfers.deletedAt))
        .groupBy(transfers.toAccountId, transfers.toCurrency, TRANSFER_UTC_DAY);
}

export function toTransferCell(row: Omit<CellRow, "income">, income: boolean): CurrencyCell {
    return {
        amount: Number(row.total ?? 0),
        amountUsd: Number(row.totalUsd ?? 0),
        count: row.rows,
        currencyCode: row.currency,
        dateKey: row.dateKey,
        income,
        rateNeededAmount: Number(row.rateNeeded ?? 0),
        rateNeededCount: Number(row.rateNeededRows ?? 0),
        unconvertedAmount: Number(row.unconverted ?? 0),
        unconvertedCount: Number(row.unconvertedRows ?? 0),
    };
}
