import { eq } from "drizzle-orm";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { useLocalData } from "@/contexts/local-data-context";
import { useLiveQuery } from "@/data/live-query";
import { parseIntSetting, SETTING_DEFAULTS } from "@/data/settings";
import { appMeta } from "@/db/schema";
import { type HapticEvent, hapticPlay } from "@/domain/haptics";

const IMPACT = {
	light: Haptics.ImpactFeedbackStyle.Light,
	medium: Haptics.ImpactFeedbackStyle.Medium,
	heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

const NOTIFICATION = {
	success: Haptics.NotificationFeedbackType.Success,
	warning: Haptics.NotificationFeedbackType.Warning,
	error: Haptics.NotificationFeedbackType.Error,
} as const;

/**
 * `useNumberSetting` takes an open `Database`, and `IdentityDraftProvider` sits
 * above the root splash gate — `useDatabase()` there throws on the first frame
 * of every launch. `null` resolves to silence rather than to the default, so
 * "no setting was read" can never mean "tap anyway".
 */
function useHapticsLevel(): number | null {
	const { db } = useLocalData();
	const rows = useLiveQuery(
		appMeta,
		() =>
			db === null
				? { all: (): { value: string | null }[] => [] }
				: db
						.select({ value: appMeta.value })
						.from(appMeta)
						.where(eq(appMeta.key, "haptics")),
		[db],
	);
	if (db === null) {
		return null;
	}
	return parseIntSetting(rows[0]?.value ?? null, SETTING_DEFAULTS.haptics);
}

/**
 * The app's only route to the taptic engine — `expo-haptics` is import-banned
 * everywhere else (biome.json). A direct call is unconditional, which is what
 * left the Haptics setting governing nothing.
 */
export function useHaptics(): (event: HapticEvent) => void {
	const level = useHapticsLevel();

	return useCallback(
		(event: HapticEvent) => {
			if (level === null) {
				return;
			}
			const play = hapticPlay(level, event);
			if (play === null) {
				return;
			}
			switch (play.kind) {
				case "selection":
					void Haptics.selectionAsync();
					return;
				case "impact":
					void Haptics.impactAsync(IMPACT[play.style]);
					return;
				case "notification":
					void Haptics.notificationAsync(NOTIFICATION[play.type]);
			}
		},
		[level],
	);
}
