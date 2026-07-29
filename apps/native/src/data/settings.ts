import { eq } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { appMeta } from "@/db/schema";
import { useLiveQuery } from "./live-query";
import {
	type BoolSettingKey,
	type NumberSettingKey,
	parseBoolSetting,
	parseIntSetting,
	SETTING_DEFAULTS,
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

export function useNumberSetting(db: Database, key: NumberSettingKey): number {
	const rows = useLiveQuery(
		appMeta,
		() => db.select().from(appMeta).where(eq(appMeta.key, key)),
		[key],
	);
	return parseIntSetting(rows[0]?.value ?? null, SETTING_DEFAULTS[key]);
}
