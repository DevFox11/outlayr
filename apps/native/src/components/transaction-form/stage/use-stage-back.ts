import { useIsFocused } from "expo-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { BackHandler } from "react-native";

/**
 * System back steps the stage back, as its own back button does, before it
 * leaves the form. Registered after the navigator's handler, so it runs first;
 * an open bottom sheet or dialog still takes the press before either. Only
 * while the form's screen is focused: a screen pushed over it (a new category,
 * a new account) keeps the form mounted, and its back is its own.
 *
 * Platform-neutral on purpose: only `stage.android.tsx` uses it.
 */
export function useStageBack(onBack: (() => void) | undefined) {
    const latest = useRef(onBack);
    useLayoutEffect(() => {
        latest.current = onBack;
    });
    const focused = useIsFocused();
    const enabled = onBack !== undefined && focused;
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            latest.current?.();
            return true;
        });
        return () => subscription.remove();
    }, [enabled]);
}
