import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import {
    ledgerSizeQuery,
    logSplitMs,
    logTailRowsQuery,
    logWindowDaysQuery,
    logWindowRowsQuery,
} from "./transactions-core";
import type { LOG_COLUMNS, Transaction } from "./transactions-core";

export function useTransactionCount(db: Database): number {
    return useLiveQuery(transactions, () => ledgerSizeQuery(db)).length;
}

/**
 * Derived from the projection, so widening the column map widens the type and
 * the two cannot drift apart.
 */
export interface CategoryDisplay {
    categoryName: string | null;
    categoryColor: string | null;
    categoryIcon: string | null;
    categoryEmoji: string | null;
}

export type TransactionWithCategory = {
    [K in keyof typeof LOG_COLUMNS]: Transaction[K];
} & CategoryDisplay;

export function useDecoratedRows<Row extends { categoryId: string | null }>(
    db: Database,
    rows: readonly Row[]
): (Row & CategoryDisplay)[] {
    const meta = useCategoryMeta(db);
    return useMemo(
        () =>
            rows.map((row) => {
                const found = row.categoryId ? meta.get(row.categoryId) : undefined;
                return {
                    ...row,
                    categoryColor: found?.color ?? null,
                    categoryEmoji: found?.emoji ?? null,
                    categoryIcon: found?.icon ?? null,
                    categoryName: found?.name ?? null,
                };
            }),
        [rows, meta]
    );
}

export interface LoggedTransactions {
    /** The window's days from `splitMs` on, newest first. */
    head: TransactionWithCategory[];
    /** False while older days remain to be fetched. */
    reachedEnd: boolean;
    /** Midnight dividing `head` from `tail`; see {@link logSplitMs}. */
    splitMs: number;
    /**
     * The window's days before `splitMs`, newest first. The same array, row
     * objects included, through any write that leaves these rows alone.
     */
    tail: TransactionWithCategory[];
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
 *
 * It comes in two reads so a grown window does not rebuild every row it holds
 * when one recent entry changes: only `head` follows the clock.
 */
export function useLoggedTransactions(db: Database, nowMs: number, days: number): LoggedTransactions {
    const dayRows = useLiveQuery(transactions, () => logWindowDaysQuery(db, nowMs, days), [nowMs, days], nowMs);

    const floorMs = dayRows.at(-1)?.day?.getTime() ?? null;
    const reachedEnd = dayRows.length < days;
    const splitMs = logSplitMs(nowMs);
    const headFloorMs = floorMs === null ? null : Math.max(floorMs, splitMs);

    const headData = useLiveQuery(
        transactions,
        () => logWindowRowsQuery(db, nowMs, headFloorMs),
        [nowMs, headFloorMs],
        nowMs
    );
    const tailData = useLiveQuery(transactions, () => logTailRowsQuery(db, floorMs, splitMs), [floorMs, splitMs]);
    const head = useDecoratedRows(db, headData);
    const tail = useDecoratedRows(db, tailData);

    return useMemo(() => ({ head, reachedEnd, splitMs, tail }), [head, reachedEnd, splitMs, tail]);
}
