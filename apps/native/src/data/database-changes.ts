import { inArray, sql } from "drizzle-orm";
import { addDatabaseChangeListener } from "expo-sqlite";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";

import type { META_KEYS } from "./app-meta-core";
import { SETTING_KEYS } from "./settings-core";
import type { BoolSettingKey, NumberSettingKey } from "./settings-core";
import { invalidateAll, subscribeToTable } from "./table-invalidation";

const pending = new Set<string>();
const pendingMetaRows = new Set<number>();
const settingListeners = new Map<Database, Set<SettingListener>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let nativeListener: { remove: () => void } | null = null;
let subscriberCount = 0;

type SettingKey = BoolSettingKey | NumberSettingKey | (typeof META_KEYS)["currency" | "walletCards"];

interface SettingListener {
    keys: readonly SettingKey[] | undefined;
    run: () => void;
}

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
        changedSettings(db, metaRows)
            .catch(() => null)
            .then((changed) => {
                for (const listener of listeners) {
                    if (settingChangeReaches(changed, listener.keys)) {
                        listener.run();
                    }
                }
            });
    }
}

/**
 * The settings among a burst's rows, or `null` when a row is already gone: it
 * was deleted and may have been any setting.
 */
async function changedSettings(db: Database, rowIds: number[]): Promise<ReadonlySet<string> | null> {
    const rows = await db
        .select({ key: appMeta.key })
        .from(appMeta)
        .where(inArray(sql`rowid`, rowIds));
    if (rows.length < rowIds.length) {
        return null;
    }
    return new Set(rows.map((row) => row.key).filter((key) => SETTING_KEYS.has(key)));
}

/**
 * Whether a burst reaches a listener on `keys`. A `null` burst hid its keys, so
 * it reaches every listener; a listener without `keys` hears every setting.
 */
export function settingChangeReaches(changed: ReadonlySet<string> | null, keys?: readonly string[]): boolean {
    if (changed === null) {
        return true;
    }
    return keys === undefined ? changed.size > 0 : keys.some((key) => changed.has(key));
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
 * `SETTING_KEYS`), or one of `keys` when given, whether from this device or
 * pulled by sync.
 *
 * `appMeta` also holds bookkeeping every sync cycle rewrites, so a listener on
 * the table alone would re-run work that reads only settings. The event names a
 * rowid, not a key, so the burst's keys are looked up once; a row already gone
 * was deleted and may have been a setting, so it counts as one.
 */
export function subscribeToSettingChanges(
    db: Database,
    listener: () => void,
    keys?: readonly SettingKey[]
): () => void {
    const release = retainNativeListener();
    const listeners = settingListeners.get(db) ?? new Set<SettingListener>();
    const entry: SettingListener = { keys, run: listener };
    listeners.add(entry);
    settingListeners.set(db, listeners);
    return () => {
        listeners.delete(entry);
        if (listeners.size === 0) {
            settingListeners.delete(db);
        }
        release();
    };
}
