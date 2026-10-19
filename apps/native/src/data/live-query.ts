import { getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { useCallback, useRef, useSyncExternalStore } from "react";

import { subscribeToTableChanges } from "./database-changes";
import { subscribeRatesRevision } from "./rates-revision";
import { sameRows } from "./same-rows";
import { useTabPaused } from "./tab-pause";
import { readNow } from "./use-now";

/**
 * A Drizzle query the expo-sqlite driver can run on the JS thread: the driver is
 * typed `BaseSQLiteDatabase<"sync", …>`, so every `db.select()…` builder answers
 * `.all()` with rows rather than with a promise.
 */
export interface SyncQuery<TRow> {
    all: () => TRow[];
}

/**
 * What `getSnapshot` hands React's change check in place of a read it skips. It
 * equals no value, so the component re-renders and reads there instead.
 */
const SKIPPED_READ = Symbol("skipped read");

interface Snapshot<TValue> {
    deps: readonly unknown[];
    /** Whether the read's `clock` was the standing `useNow()` reading. */
    followsClock: boolean;
    revision: number;
    value: TValue;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
    return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

/**
 * Reads `build()` **during render** and re-reads it on every write to `table`.
 *
 * Use this instead of `useLiveQuery` from `drizzle-orm/expo-sqlite`. That one
 * seeds its state with `[]` and only runs the query from a `useEffect`, so a
 * screen's first painted frame always shows zero rows, and chained reads add an
 * effect pass each. `getAllSync` executes on the JS thread, so the rows can be
 * in hand before the first frame instead: an empty array here means the table is
 * empty, not that nothing has loaded yet.
 *
 * `deps` follows the same contract as a dependency array: `build` closes over
 * its inputs, and the query only re-runs when one of `deps` changes (by
 * `Object.is`) or the table is written. Anything the query reads that can change
 * belongs in it.
 *
 * A query that throws propagates to the root error boundary rather than becoming
 * an `error` field.
 *
 * Only writes to `table` invalidate the read, since
 * `addDatabaseChangeListener` reports one table per event, and a burst of them
 * re-reads once (see `subscribeToTableChanges`). A query whose *rows*
 * depend on another table (a join, or an `inArray` over ids read elsewhere) must
 * resolve that table through its own subscription and pass the result in through
 * `deps`; see `useCategoryMeta`.
 *
 * A re-read that finds the same rows, column by column, hands back the previous
 * array, so a write that leaves this query's rows alone re-renders nothing.
 *
 * `clock` is the time the query is bounded by, when that can be the `useNow()`
 * reading. While it follows the reading, a ledger write moves both, so the
 * render that follows reads with the new bound anyway, and the read React's
 * change check would make with the old one is skipped. A bound pinned elsewhere
 * reads in the check as before.
 */
export function useLiveQuery<TRow extends object>(
    table: SQLiteTable,
    build: () => SyncQuery<TRow>,
    deps: readonly unknown[] = [],
    clock?: number
): TRow[] {
    return useLiveRead(table, () => build().all(), deps, sameRows, clock);
}

/**
 * {@link useLiveQuery} narrowed to what the caller actually reads.
 *
 * `select` runs on the rows inside the snapshot, so the value React compares is
 * the derived one. A consumer watching a count or a single field therefore sits
 * still through every write that leaves that value alone, even one that changes
 * the rows it was derived from — the whole table is one invalidation channel
 * (see the note above), so an unrelated write is the common case, not the rare
 * one.
 *
 * `select` must be pure and must derive something comparable by `Object.is` —
 * a primitive, or a value it returns identically for identical rows.
 */
export function useLiveValue<TRow, TValue>(
    table: SQLiteTable,
    build: () => SyncQuery<TRow>,
    select: (rows: TRow[]) => TValue,
    deps: readonly unknown[] = []
): TValue {
    return useLiveRead(table, () => select(build().all()), deps);
}

/**
 * The read under {@link useLiveQuery}, for a value of the caller's shape. When
 * only `deps` changed since the last read, with no write to `table` reported in
 * between, `read` gets the value it returned then and may build on it instead of
 * reading everything again; otherwise it gets null. A write still waiting to be
 * reported re-reads in full once it is. `equal` keeps the cached value when a
 * read finds the same one.
 */
export function useLiveRead<TValue>(
    table: SQLiteTable,
    read: (previous: TValue | null) => TValue,
    deps: readonly unknown[],
    equal?: (cached: TValue, next: TValue) => boolean,
    clock?: number
): TValue {
    const tableName = getTableName(table);
    const subscribeTable = useCallback((bump: () => void) => subscribeToTableChanges(tableName, bump), [tableName]);
    return useRead(subscribeTable, read, deps, equal, clock);
}

export function useRatesRead<TValue>(read: () => TValue, deps: readonly unknown[] = []): TValue {
    return useRead(subscribeRatesRevision, read, deps);
}

function useRead<TValue>(
    subscribeChanges: (bump: () => void) => () => void,
    read: (previous: TValue | null) => TValue,
    deps: readonly unknown[],
    equal?: (cached: TValue, next: TValue) => boolean,
    clock?: number
): TValue {
    const revision = useRef(0);
    const snapshot = useRef<Snapshot<TValue> | null>(null);
    const inChangeCheck = useRef(false);
    const subscribePaused = useTabPaused(subscribeChanges);

    const subscribe = useCallback(
        (onStoreChange: () => void) =>
            subscribePaused(() => {
                revision.current += 1;
                inChangeCheck.current = true;
                try {
                    onStoreChange();
                } finally {
                    inChangeCheck.current = false;
                }
            }),
        [subscribePaused]
    );

    // React calls this on every render to detect a change, so it must return the
    // identical value until something actually invalidates it — re-reading (or
    // even re-wrapping the rows) here would loop forever.
    const getSnapshot = (): TValue | typeof SKIPPED_READ => {
        const cached = snapshot.current;
        if (cached !== null && cached.revision === revision.current && sameDeps(cached.deps, deps)) {
            return cached.value;
        }
        // The change check runs the committed closure: when its read followed the
        // clock and the clock has moved since, these `deps` are stale and the render
        // reads anyway. A render never skips: one whose bound stays put would loop.
        if (inChangeCheck.current && cached?.followsClock && clock !== readNow()) {
            return SKIPPED_READ;
        }
        const next = read(cached !== null && cached.revision === revision.current ? cached.value : null);
        const value = cached !== null && equal?.(cached.value, next) ? cached.value : next;
        snapshot.current = { deps, followsClock: clock === readNow(), revision: revision.current, value };
        return value;
    };

    const value = useSyncExternalStore(subscribe, getSnapshot);
    if (value === SKIPPED_READ) {
        throw new Error("A live read was skipped outside React's change check");
    }
    return value;
}
