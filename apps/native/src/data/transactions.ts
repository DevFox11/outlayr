import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { growing } from "@/lib/growing";

import { useCategoryMeta } from "./categories";
import { useLiveQuery, useLiveRead } from "./live-query";
import { sameRows } from "./same-rows";
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

type LogRow = {
    [K in keyof typeof LOG_COLUMNS]: Transaction[K];
};

export type TransactionWithCategory = LogRow & CategoryDisplay;

export function useDecoratedRows<Row extends { categoryId: string | null }>(
    db: Database,
    rows: readonly Row[]
): (Row & CategoryDisplay)[] {
    const meta = useCategoryMeta(db);
    const decorate = useMemo(
        () =>
            growing(
                (page: readonly Row[]) =>
                    page.map((row) => {
                        const found = row.categoryId ? meta.get(row.categoryId) : undefined;
                        return {
                            ...row,
                            categoryColor: found?.color ?? null,
                            categoryEmoji: found?.emoji ?? null,
                            categoryIcon: found?.icon ?? null,
                            categoryName: found?.name ?? null,
                        };
                    }),
                (held, added) => [...held, ...added]
            ),
        [meta]
    );
    return useMemo(() => decorate(rows), [decorate, rows]);
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

interface LogTail {
    /** The midnight `rows` start from; `splitMs` when the window ends above it. */
    floorMs: number;
    rows: LogRow[];
    splitMs: number;
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
 * when one recent entry changes: only `head` follows the clock. Paging only
 * moves the floor older, so `tail` then reads just the new days and appends
 * them to the rows it holds, which keep their objects.
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
    const tailFloorMs = Math.min(floorMs ?? splitMs, splitMs);
    const tailRead = useLiveRead(
        transactions,
        (previous: LogTail | null): LogTail => {
            const grown = previous !== null && previous.splitMs === splitMs && tailFloorMs < previous.floorMs;
            const rows = grown
                ? [...previous.rows, ...logTailRowsQuery(db, tailFloorMs, previous.floorMs).all()]
                : logTailRowsQuery(db, tailFloorMs, splitMs).all();
            return { floorMs: tailFloorMs, rows, splitMs };
        },
        [tailFloorMs, splitMs],
        (cached, next) => sameRows(cached.rows, next.rows)
    );
    const head = useDecoratedRows(db, headData);
    const tail = useDecoratedRows(db, tailRead.rows);

    return useMemo(() => ({ head, reachedEnd, splitMs, tail }), [head, reachedEnd, splitMs, tail]);
}
