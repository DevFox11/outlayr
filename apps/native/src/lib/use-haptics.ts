import {
    ImpactFeedbackStyle,
    impactAsync,
    NotificationFeedbackType,
    notificationAsync,
    selectionAsync,
} from "expo-haptics";
import { useCallback } from "react";

import { useLocalData } from "@/contexts/local-data-context";
import { useNumberSetting } from "@/data/settings";
import { hapticPlay } from "@/domain/haptics";
import type { HapticEvent } from "@/domain/haptics";

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
 * The nullable `db` rather than `useDatabase()`: `IdentityDraftProvider` sits
 * above the root splash gate, where that throws on the first frame of every
 * launch. `null` resolves to silence rather than to the default, so "no setting
 * was read" can never mean "tap anyway" — which is why this cannot be
 * `useSettingNumber`, whose unread value is the default.
 */
function useHapticsLevel(): number | null {
    const { db } = useLocalData();
    const level = useNumberSetting(db, "haptics");
    return db === null ? null : level;
}

/**
 * The app's only route to the taptic engine — `expo-haptics` is import-banned
 * everywhere else (oxlint.config.ts). A direct call is unconditional, which is what
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
                case "selection": {
                    // oxlint-disable-next-line no-void -- the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
                    void selectionAsync();
                    return;
                }
                case "impact": {
                    // oxlint-disable-next-line no-void -- the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
                    void impactAsync(IMPACT[play.style]);
                    return;
                }
                case "notification": {
                    // oxlint-disable-next-line no-void -- the taptic engine is fire-and-forget here; this callback is synchronous and its caller has nothing to do with the promise
                    void notificationAsync(NOTIFICATION[play.type]);
                    return;
                }
                default: {
                    const unhandled: never = play;
                    throw new Error(`Unhandled haptic play: ${JSON.stringify(unhandled)}`);
                }
            }
        },
        [level]
    );
}
