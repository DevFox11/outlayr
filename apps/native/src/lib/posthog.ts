import { env } from "@outlayr/env/native";
import { usePathname, useSegments } from "expo-router";
import PostHog from "posthog-react-native";
import { useEffect } from "react";

export const posthog =
    !__DEV__ && env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN && env.EXPO_PUBLIC_POSTHOG_HOST
        ? new PostHog(env.EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN, {
              disableRemoteFeatureFlags: true,
              errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
              host: env.EXPO_PUBLIC_POSTHOG_HOST,
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
