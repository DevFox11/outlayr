import { desc, isNull } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import { ledgerSizeQuery, logWindowDaysQuery, logWindowRowsQuery } from "./transactions-core";
import type { LOG_COLUMNS, Transaction } from "./transactions-core";

export function useTransactionCount(db: Database): number {
    return useLiveQuery(transactions, () => ledgerSizeQuery(db)).length;
}

/**
 * Newest lines, without the day-bucketing and future boundary the log window
 * carries — first run only needs the last line or two to draw on its page.
 */
export function useRecentLines(db: Database, limit: number): Transaction[] {
    // SAFETY: as in `data/accounts.ts` — the table argument pins the row type.
    return useLiveQuery(
        transactions,
        () =>
            db
                .select()
                .from(transactions)
                .where(isNull(transactions.deletedAt))
                .orderBy(desc(transactions.date))
                .limit(limit),
        [limit]
    ) as Transaction[];
}

/**
 * Derived from the projection, so widening the column map widens the type and
 * the two cannot drift apart.
 */
export type TransactionWithCategory = {
    [K in keyof typeof LOG_COLUMNS]: Transaction[K];
} & {
    categoryName: string | null;
    categoryColor: string | null;
    categoryIcon: string | null;
    categoryEmoji: string | null;
};

export interface LoggedTransactions {
    /** False while older days remain to be fetched. */
    reachedEnd: boolean;
    rows: TransactionWithCategory[];
}

/**
 * Newest first. `nowMs` is a dependency so the "future rows hidden" boundary
 * only moves when the caller intends.
 *
 * The category fields come from {@link useCategoryMeta}, not a join: a join
 * would leave every row showing a renamed category's old name and colour until
 * some *transaction* was written.
 *
 * The window is measured in **days, not rows**, so a day is never cut in half
 * under its own signed subtotal, and it grows rather than paging: `useLiveQuery`
 * re-runs on every write to the table, and under that a cursor is unsound —
 * inserting a transaction above it shifts every later page, duplicating or
 * skipping rows.
 */
export function useLoggedTransactions(db: Database, nowMs: number, days: number): LoggedTransactions {
    const dayRows = useLiveQuery(transactions, () => logWindowDaysQuery(db, nowMs, days), [nowMs, days]);

    const floorMs = dayRows.at(-1)?.day?.getTime() ?? null;
    const reachedEnd = dayRows.length < days;

    const data = useLiveQuery(transactions, () => logWindowRowsQuery(db, nowMs, floorMs), [nowMs, floorMs]);
    const categoryMeta = useCategoryMeta(db);

    const rows = useMemo(
        () =>
            data.map((row) => {
                const meta = row.categoryId ? categoryMeta.get(row.categoryId) : undefined;
                return {
                    ...row,
                    categoryColor: meta?.color ?? null,
                    categoryEmoji: meta?.emoji ?? null,
                    categoryIcon: meta?.icon ?? null,
                    categoryName: meta?.name ?? null,
                };
            }),
        [data, categoryMeta]
    );

    return useMemo(() => ({ reachedEnd, rows }), [rows, reachedEnd]);
}
