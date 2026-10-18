import { addDatabaseChangeListener } from "expo-sqlite";

import { invalidateAll, subscribeToTable } from "./table-invalidation";

const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let nativeListener: { remove: () => void } | null = null;
let subscriberCount = 0;

function flush(): void {
    flushTimer = null;
    const tableNames = [...pending];
    pending.clear();
    invalidateAll(tableNames);
}

function startNativeListener(): void {
    nativeListener = addDatabaseChangeListener((event) => {
        pending.add(event.tableName);
        flushTimer ??= setTimeout(flush, 0);
    });
}

function stopNativeListener(): void {
    nativeListener?.remove();
    nativeListener = null;
    if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    pending.clear();
}

/**
 * Calls `listener` after writes to `tableName`, once per burst rather than once
 * per row.
 *
 * SQLite's update hook reports every row a write touches as its own native
 * event, so a 1,000-row sync page or CSV import would otherwise re-run every
 * live read on the table a thousand times. Events are collected into one native
 * listener for the app and delivered on the next tick through the channel batch
 * writers already call directly (`invalidate`).
 */
export function subscribeToTableChanges(tableName: string, listener: () => void): () => void {
    if (subscriberCount === 0) {
        startNativeListener();
    }
    subscriberCount += 1;
    const unsubscribe = subscribeToTable(tableName, listener);
    return () => {
        unsubscribe();
        subscriberCount -= 1;
        if (subscriberCount === 0) {
            stopNativeListener();
        }
    };
}
