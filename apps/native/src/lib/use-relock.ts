import { useEffect } from "react";
import { AppState } from "react-native";

import { relocksOnPhase } from "@/domain/app-lock";

/** Calls `relock` every time the app stops being the one in front. */
export function useRelock(relock: () => void): void {
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (phase) => {
            if (relocksOnPhase(phase)) {
                relock();
            }
        });
        return () => {
            subscription.remove();
        };
    }, [relock]);
}
