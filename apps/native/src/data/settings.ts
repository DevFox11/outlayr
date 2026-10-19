import { eq, inArray } from "drizzle-orm";
import { useCalendars } from "expo-localization";
import { useEffect, useMemo } from "react";

import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";

import { useLiveQuery, useLiveValue } from "./live-query";
import type { SyncQuery } from "./live-query";
import {
    parseAiConsent,
    parseBoolSetting,
    parseIntSetting,
    SETTING_DEFAULTS,
    seedClockPreference,
} from "./settings-core";
import type { AiConsent, BoolSettingKey, NumberSettingKey } from "./settings-core";

export interface SettingsSnapshot {
    bool: (key: BoolSettingKey) => boolean;
    number: (key: NumberSettingKey) => number;
}

type MetaRow = typeof appMeta.$inferSelect;

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS);

/**
 * Every setting from one subscription, as a snapshot whose identity moves only
 * when a stored setting does. The bookkeeping that shares `appMeta` (sync
 * cursors, the enrichment outbox, rate stamps) never reaches it. Published
 * through a context it still re-renders every consumer for a toggle none of them
 * read, so prefer `useBoolSetting`/`useNumberSetting` wherever the render is
 * worth more than the keyed lookup they run.
 */
export function useAllSettings(db: Database | null): SettingsSnapshot {
    // Nullable because `AppSettingsProvider` mounts above the root splash gate and
    // so renders while the database is still opening; the defaults it publishes in
    // that window are never observed, since every consumer sits below the gate.
    const rows = useLiveQuery(appMeta, () => selectSettings(db), [db]);
    return useMemo(() => settingsSnapshot(rows), [rows]);
}

export function settingsSnapshot(rows: readonly MetaRow[]): SettingsSnapshot {
    const raw = new Map(rows.map((row) => [row.key, row.value]));
    return {
        bool: (key) => parseBoolSetting(raw.get(key) ?? null, SETTING_DEFAULTS[key]),
        number: (key) => parseIntSetting(raw.get(key) ?? null, SETTING_DEFAULTS[key]),
    };
}

export function useBoolSetting(db: Database | null, key: BoolSettingKey): boolean {
    return useLiveValue(
        appMeta,
        () => selectSetting(db, key),
        (rows) => parseBoolSetting(rows[0]?.value ?? null, SETTING_DEFAULTS[key]),
        [db, key]
    );
}

/** The `aiConsentV2` row with an unasked question kept apart from Not now. */
export function useAiConsent(db: Database | null): AiConsent {
    return useLiveValue(
        appMeta,
        () => selectSetting(db, "aiConsentV2"),
        (rows) => parseAiConsent(rows[0]?.value ?? null),
        [db]
    );
}

/**
 * Adopts the handset's clock convention, once, on the first launch that can read
 * it. Mounted at the root and not on Time & Frames: a user in a 24-hour locale
 * has no reason to open that screen, and until they did every timestamp in the
 * app — rows, upcoming, the shared day card — read back in a format their device
 * does not use. `seedClockPreference` declines to overrule a stored choice, so
 * running it every launch costs one read.
 */
export function useSeededClockPreference(db: Database): void {
    // `uses24hourClock` is null on a device that reports no preference, which is
    // not the same as reporting 12-hour — treat it as "nothing to seed from".
    const deviceUses24Hour = useCalendars()[0].uses24hourClock;

    useEffect(() => {
        if (deviceUses24Hour == null) {
            return;
        }
        seedClockPreference(db, deviceUses24Hour);
    }, [db, deviceUses24Hour]);
}

export function useNumberSetting(db: Database | null, key: NumberSettingKey): number {
    return useLiveValue(
        appMeta,
        () => selectSetting(db, key),
        (rows) => parseIntSetting(rows[0]?.value ?? null, SETTING_DEFAULTS[key]),
        [db, key]
    );
}

// Nullable for the same reason `useAllSettings` is: these run above the root
// splash gate while the database is still opening.
function selectSetting(
    db: Database | null,
    key: BoolSettingKey | NumberSettingKey
): SyncQuery<{ value: string | null }> {
    if (db == null) {
        return { all: () => [] };
    }
    return db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, key));
}

/** Only the stored settings: the bookkeeping that shares `appMeta` never reaches the read. */
export function selectSettings(db: Database | null): SyncQuery<MetaRow> {
    if (db == null) {
        return { all: () => [] };
    }
    return db.select().from(appMeta).where(inArray(appMeta.key, SETTING_KEYS));
}
