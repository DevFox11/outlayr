import { inArray, sql } from "drizzle-orm";
import { addDatabaseChangeListener } from "expo-sqlite";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";

import { SETTING_KEYS } from "./settings-core";
import { invalidateAll, subscribeToTable } from "./table-invalidation";

const pending = new Set<string>();
const pendingMetaRows = new Set<number>();
const settingListeners = new Map<Database, Set<() => void>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let nativeListener: { remove: () => void } | null = null;
let subscriberCount = 0;

function flush(): void {
    flushTimer = null;
    const tableNames = [...pending];
    const metaRows = [...pendingMetaRows];
    pending.clear();
    pendingMetaRows.clear();
    invalidateAll(tableNames);
    if (metaRows.length === 0) {
        return;
    }
    for (const [db, listeners] of settingListeners) {
        settingChanged(db, metaRows)
            .catch(() => true)
            .then((changed) => {
                if (changed) {
                    for (const listener of listeners) {
                        listener();
                    }
                }
            });
    }
}

async function settingChanged(db: Database, rowIds: number[]): Promise<boolean> {
    const rows = await db
        .select({ key: appMeta.key })
        .from(appMeta)
        .where(inArray(sql`rowid`, rowIds));
    return rows.length < rowIds.length || rows.some((row) => SETTING_KEYS.has(row.key));
}

function startNativeListener(): void {
    nativeListener = addDatabaseChangeListener((event) => {
        pending.add(event.tableName);
        if (event.tableName === "appMeta") {
            pendingMetaRows.add(event.rowId);
        }
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
    pendingMetaRows.clear();
}

function retainNativeListener(): () => void {
    if (subscriberCount === 0) {
        startNativeListener();
    }
    subscriberCount += 1;
    return () => {
        subscriberCount -= 1;
        if (subscriberCount === 0) {
            stopNativeListener();
        }
    };
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
    const release = retainNativeListener();
    const unsubscribe = subscribeToTable(tableName, listener);
    return () => {
        unsubscribe();
        release();
    };
}

/**
 * Calls `listener` after a burst of writes that changed a setting (see
 * `SETTING_KEYS`), whether from this device or pulled by sync.
 *
 * `appMeta` also holds bookkeeping every sync cycle rewrites, so a listener on
 * the table alone would re-run work that reads only settings. The event names a
 * rowid, not a key, so the burst's keys are looked up once; a row already gone
 * was deleted and may have been a setting, so it counts as one.
 */
export function subscribeToSettingChanges(db: Database, listener: () => void): () => void {
    const release = retainNativeListener();
    const listeners = settingListeners.get(db) ?? new Set<() => void>();
    listeners.add(listener);
    settingListeners.set(db, listeners);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            settingListeners.delete(db);
        }
        release();
    };
}
