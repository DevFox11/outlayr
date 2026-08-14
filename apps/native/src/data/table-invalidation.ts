type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

/**
 * A second invalidation channel for `useLiveQuery`, alongside SQLite's own
 * per-row update hook.
 *
 * The hook does fire for writes inside a transaction, so a bulk apply is not
 * invisible to it. But it is per-row and native, which makes "did the screen
 * repaint after this batch?" a question about event ordering rather than about
 * the code. A batch writer says so explicitly instead, and does it once for the
 * whole batch rather than once per row.
 *
 * Deliberately free of `expo-sqlite` and React so `-core.ts` modules can reach
 * it under the node test runner.
 */
export function subscribeToTable(tableName: string, listener: Listener): () => void {
    const existing = listeners.get(tableName) ?? new Set<Listener>();
    existing.add(listener);
    listeners.set(tableName, existing);

    return () => {
        const current = listeners.get(tableName);
        if (!current) {
            return;
        }
        current.delete(listener);
        if (current.size === 0) {
            listeners.delete(tableName);
        }
    };
}

/**
 * Iterated over a copy, so a listener that unsubscribes itself while being
 * notified cannot skip the one after it.
 */
export function invalidate(tableName: string): void {
    const current = listeners.get(tableName);
    if (!current) {
        return;
    }
    // oxlint-disable-next-line unicorn/no-useless-spread -- a listener can detach while being notified, which would skip the one after it
    for (const listener of [...current]) {
        listener();
    }
}

export function invalidateAll(tableNames: Iterable<string>): void {
    for (const tableName of new Set(tableNames)) {
        invalidate(tableName);
    }
}
