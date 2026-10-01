import { env } from "@outlayr/env/native";
import { usePathname, useSegments } from "expo-router";
import PostHog from "posthog-react-native";
import { useEffect } from "react";

import { SETTING_DEFAULTS } from "@/data/settings-core";
import { scrubQueryParams } from "@/domain/exception-scrub";

export const posthog =
    !__DEV__ && env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN
        ? new PostHog(env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN, {
              before_send: scrubQueryParams,
              defaultOptIn: SETTING_DEFAULTS.shareAnalytics,
              disableRemoteFeatureFlags: true,
              errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
          })
        : null;

export function useScreenTracking() {
    const pathname = usePathname();
    const screen = useSegments().join("/");
    useEffect(() => {
        if (screen) {
            posthog?.screen(screen);
        }
    }, [pathname, screen]);
}
