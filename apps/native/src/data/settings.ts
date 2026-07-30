import { eq } from "drizzle-orm";
import { useCalendars } from "expo-localization";
import { useEffect, useMemo } from "react";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { useLiveQuery } from "./live-query";
import {
	type BoolSettingKey,
	type NumberSettingKey,
	parseBoolSetting,
	parseIntSetting,
	SETTING_DEFAULTS,
	seedClockPreference,
} from "./settings-core";

export * from "./settings-core";

export interface SettingsSnapshot {
	bool: (key: BoolSettingKey) => boolean;
	number: (key: NumberSettingKey) => number;
}

/**
 * Every setting from one subscription. `useBoolSetting`/`useNumberSetting` each
 * register their own `addDatabaseChangeListener`, and that listener fires on ANY
 * `appMeta` write — not just the watched key — so a screen reading nine settings
 * runs nine queries and nine re-renders for one toggle tap. Prefer this on any
 * screen reading more than one or two.
 */
export function useAllSettings(db: Database): SettingsSnapshot {
	const rows = useLiveQuery(appMeta, () => db.select().from(appMeta));

	return useMemo(() => {
		const raw = new Map<string, string | null>();
		for (const row of rows) {
			raw.set(row.key, row.value);
		}
		return {
			bool: (key) =>
				parseBoolSetting(raw.get(key) ?? null, SETTING_DEFAULTS[key]),
			number: (key) =>
				parseIntSetting(raw.get(key) ?? null, SETTING_DEFAULTS[key]),
		};
	}, [rows]);
}

export function useBoolSetting(db: Database, key: BoolSettingKey): boolean {
	const rows = useLiveQuery(
		appMeta,
		() => db.select().from(appMeta).where(eq(appMeta.key, key)),
		[key],
	);
	return parseBoolSetting(rows[0]?.value ?? null, SETTING_DEFAULTS[key]);
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

export function useNumberSetting(db: Database, key: NumberSettingKey): number {
	const rows = useLiveQuery(
		appMeta,
		() => db.select().from(appMeta).where(eq(appMeta.key, key)),
		[key],
	);
	return parseIntSetting(rows[0]?.value ?? null, SETTING_DEFAULTS[key]);
}
