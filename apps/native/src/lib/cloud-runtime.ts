import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { cloudConfiguration, env } from "@outlayr/env/native";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";
import { getItem, setItem } from "expo-secure-store";

function createCloudRuntime() {
    if (cloudConfiguration() !== "configured") {
        return null;
    }

    const convexUrl = env.EXPO_PUBLIC_CONVEX_URL;
    const siteUrl = env.EXPO_PUBLIC_CONVEX_SITE_URL;
    if (!(convexUrl && siteUrl)) {
        return null;
    }

    const configuredScheme = Constants.expoConfig?.scheme;
    const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;
    if (!scheme) {
        return null;
    }

    return {
        authClient: createAuthClient({
            baseURL: siteUrl,
            plugins: [
                convexClient(),
                expoClient({
                    scheme,
                    storage: { getItem, setItem },
                    storagePrefix: scheme,
                }),
            ],
        }),
        convex: new ConvexReactClient(convexUrl, {
            unsavedChangesWarning: false,
        }),
    };
}

export type CloudRuntime = NonNullable<ReturnType<typeof createCloudRuntime>>;

export const cloudRuntime: CloudRuntime | null = createCloudRuntime();
