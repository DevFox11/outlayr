import { getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * A Drizzle query the expo-sqlite driver can run on the JS thread: the driver is
 * typed `BaseSQLiteDatabase<"sync", …>`, so every `db.select()…` builder answers
 * `.all()` with rows rather than with a promise.
 */
export interface SyncQuery<TRow> {
	all(): TRow[];
}

interface Snapshot<TRow> {
	deps: readonly unknown[];
	revision: number;
	rows: TRow[];
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
	deps: readonly unknown[] = [],
): TRow[] {
	const tableName = getTableName(table);
	const revision = useRef(0);
	const snapshot = useRef<Snapshot<TRow> | null>(null);

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const listener = addDatabaseChangeListener((event) => {
				if (event.tableName !== tableName) {
					return;
				}
				// Bumping a counter rather than re-querying here collapses a bulk write
				// into one read: a 200-row backfill fires 200 events, React coalesces
				// the notifications, and the query below runs once for the batch.
				revision.current += 1;
				onStoreChange();
			});
			return () => {
				listener.remove();
			};
		},
		[tableName],
	);

	// React calls this on every render to detect a change, so it must return the
	// identical array until something actually invalidates it — re-querying (or
	// even re-wrapping the rows) here would loop forever.
	const getSnapshot = (): TRow[] => {
		const cached = snapshot.current;
		if (
			cached !== null &&
			cached.revision === revision.current &&
			sameDeps(cached.deps, deps)
		) {
			return cached.rows;
		}
		const rows = build().all();
		snapshot.current = { deps, revision: revision.current, rows };
		return rows;
	};

	return useSyncExternalStore(subscribe, getSnapshot);
}
