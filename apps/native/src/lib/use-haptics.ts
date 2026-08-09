import { eq } from "drizzle-orm";
import {
	ImpactFeedbackStyle,
	impactAsync,
	NotificationFeedbackType,
	notificationAsync,
	selectionAsync,
} from "expo-haptics";
import { useCallback } from "react";
import { useLocalData } from "@/contexts/local-data-context";
import { useLiveQuery } from "@/data/live-query";
import { parseIntSetting, SETTING_DEFAULTS } from "@/data/settings-core";
import { appMeta } from "@/db/schema";
import { type HapticEvent, hapticPlay } from "@/domain/haptics";

const IMPACT = {
	heavy: ImpactFeedbackStyle.Heavy,
	light: ImpactFeedbackStyle.Light,
	medium: ImpactFeedbackStyle.Medium,
} as const;

const NOTIFICATION = {
	error: NotificationFeedbackType.Error,
	success: NotificationFeedbackType.Success,
	warning: NotificationFeedbackType.Warning,
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
				: db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, "haptics")),
		[db]
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
					// biome-ignore lint/complexity/noVoid: the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
					void selectionAsync();
					return;
				case "impact":
					// biome-ignore lint/complexity/noVoid: the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
					void impactAsync(IMPACT[play.style]);
					return;
				case "notification":
					// biome-ignore lint/complexity/noVoid: the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
					void notificationAsync(NOTIFICATION[play.type]);
					return;
				default: {
					const unhandled: never = play;
					throw new Error(`Unhandled haptic play: ${JSON.stringify(unhandled)}`);
				}
			}
		},
		[level]
	);
}
