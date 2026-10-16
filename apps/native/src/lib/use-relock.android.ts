import { useEffect } from "react";
import { AppState } from "react-native";

import { handoffOverran, takeHandoff } from "@/lib/app-handoff";
import type { useRelock as iosUseRelock } from "@/lib/use-relock";

/**
 * Android has no `inactive`, and `background` looks the same whether the user
 * pressed Home or Outlayr opened the camera, a picker, the share sheet, a
 * Custom Tab, Play Billing or Google sign-in: each of those is an activity of
 * its own. So leaving relocks, unless Outlayr announced the trip just before it
 * went, and a trip that runs past `HANDOFF_TRIP_CAP_MS` relocks on the way back
 * (a detour from it to Home is invisible from here).
 */
export const useRelock: typeof iosUseRelock = (relock) => {
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (phase) => {
            if (phase === "background" && !takeHandoff()) {
                relock();
            }
            if (phase === "active" && handoffOverran()) {
                relock();
            }
        });
        return () => {
            subscription.remove();
        };
    }, [relock]);
};
