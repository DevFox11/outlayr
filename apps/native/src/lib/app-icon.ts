import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

import { appIconTransition } from "@/domain/app-icons";
import type { AppIconEvent, AppIconState } from "@/domain/app-icons";
import { translateNow } from "@/i18n/runtime";

export const alternateIconsSupported: boolean = supportsAlternateIcons;

/**
 * iOS is the only record of which icon is on — nothing is persisted app-side,
 * so a setting can never disagree with the home screen.
 */
function readAppIconName(): string | null {
    try {
        return getAppIconName();
    } catch {
        return null;
    }
}

export function useAppIcon(): {
    active: string | null;
    choose: (name: string | null) => void;
} {
    const [state, setState] = useState<AppIconState>(() => ({
        active: readAppIconName(),
        pending: null,
    }));
    /**
     * `choose` has to read the in-flight request synchronously to decide whether
     * to call into iOS at all, which a queued state updater cannot report back.
     */
    const latest = useRef(state);

    const commit = useCallback((next: AppIconState) => {
        latest.current = next;
        setState(next);
    }, []);

    const apply = useCallback(
        (event: AppIconEvent): boolean => {
            const next = appIconTransition(latest.current, event);
            if (next === latest.current) {
                return false;
            }
            commit(next);
            return true;
        },
        [commit]
    );

    useFocusEffect(
        useCallback(() => {
            // Re-reading mid-flight would undo the optimistic tap for a frame.
            if (latest.current.pending === null) {
                commit({ active: readAppIconName(), pending: null });
            }
        }, [commit])
    );

    const choose = useCallback(
        (name: string | null) => {
            if (!apply({ kind: "tap", name })) {
                return;
            }
            setAlternateAppIcon(name)
                .then(() => {
                    apply({ kind: "resolved", name });
                })
                .catch((error: unknown) => {
                    console.error("App icon change failed", error);
                    apply({ kind: "rejected", reported: readAppIconName() });
                    Alert.alert(
                        translateNow("settings.appIcon.failedTitle"),
                        translateNow("settings.appIcon.failedBody")
                    );
                });
        },
        [apply]
    );

    return { active: state.active, choose };
}
