import { getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useCallback, useRef, useSyncExternalStore } from "react";

import { subscribeRatesRevision } from "./rates-revision";
import { subscribeToTable } from "./table-invalidation";

/**
 * A Drizzle query the expo-sqlite driver can run on the JS thread: the driver is
 * typed `BaseSQLiteDatabase<"sync", …>`, so every `db.select()…` builder answers
 * `.all()` with rows rather than with a promise.
 */
export interface SyncQuery<TRow> {
    all: () => TRow[];
}

interface Snapshot<TValue> {
    deps: readonly unknown[];
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
 * `addDatabaseChangeListener` reports one table per event. A query whose *rows*
 * depend on another table (a join, or an `inArray` over ids read elsewhere) must
 * resolve that table through its own subscription and pass the result in through
 * `deps`; see `useCategoryMeta`.
 */
export function useLiveQuery<TRow>(
    table: SQLiteTable,
    build: () => SyncQuery<TRow>,
    deps: readonly unknown[] = []
): TRow[] {
    return useLiveRead(table, () => build().all(), deps);
}

/**
 * {@link useLiveQuery} narrowed to what the caller actually reads.
 *
 * `select` runs on the rows inside the snapshot, so the value React compares is
 * the derived one. A consumer watching a single setting therefore sits still
 * through every `appMeta` write that leaves its own key alone, where
 * `useLiveQuery` would hand back a fresh array and re-render it — the whole
 * table is one invalidation channel (see the note above), so an unrelated write
 * is the common case, not the rare one.
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

function useLiveRead<TValue>(table: SQLiteTable, read: () => TValue, deps: readonly unknown[]): TValue {
    const tableName = getTableName(table);
    const subscribeTable = useCallback(
        (bump: () => void) => {
            const listener = addDatabaseChangeListener((event) => {
                if (event.tableName === tableName) {
                    bump();
                }
            });
            // A batch writer that does not go row by row — the sync applier — says so
            // once for the whole batch rather than leaving the repaint to the order
            // of a few thousand native events.
            const unsubscribe = subscribeToTable(tableName, bump);
            return () => {
                listener.remove();
                unsubscribe();
            };
        },
        [tableName]
    );
    return useRead(subscribeTable, read, deps);
}

export function useRatesRead<TValue>(read: () => TValue, deps: readonly unknown[] = []): TValue {
    return useRead(subscribeRatesRevision, read, deps);
}

function useRead<TValue>(
    subscribeChanges: (bump: () => void) => () => void,
    read: () => TValue,
    deps: readonly unknown[]
): TValue {
    const revision = useRef(0);
    const snapshot = useRef<Snapshot<TValue> | null>(null);

    const subscribe = useCallback(
        (onStoreChange: () => void) =>
            subscribeChanges(() => {
                revision.current += 1;
                onStoreChange();
            }),
        [subscribeChanges]
    );

    // React calls this on every render to detect a change, so it must return the
    // identical value until something actually invalidates it — re-reading (or
    // even re-wrapping the rows) here would loop forever.
    const getSnapshot = (): TValue => {
        const cached = snapshot.current;
        if (cached !== null && cached.revision === revision.current && sameDeps(cached.deps, deps)) {
            return cached.value;
        }
        const value = read();
        snapshot.current = { deps, revision: revision.current, value };
        return value;
    };

    return useSyncExternalStore(subscribe, getSnapshot);
}
