import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
    z.url().refine((url) => new URL(url).hostname !== exampleHost, {
        message: `Replace the ${exampleHost} placeholder before running the app`,
    });

export const env = createEnv({
    client: {
        EXPO_PUBLIC_CONVEX_SITE_URL: convexUrlSchema("example.convex.site").optional(),
        EXPO_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud").optional(),
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: z.string().optional(),
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: z.string().optional(),
        // logo.dev publishable token (`pk_…`), meant to ship in the client. Absent
        // simply drops that tier: App Store icons and favicons still resolve.
        EXPO_PUBLIC_LOGO_DEV_TOKEN: z.string().optional(),
    },
    clientPrefix: "EXPO_PUBLIC_",
    emptyStringAsUndefined: true,
    runtimeEnv: process.env,
});

export type CloudConfiguration = "configured" | "misconfigured" | "unconfigured";

export function cloudConfiguration({
    convexSiteUrl = env.EXPO_PUBLIC_CONVEX_SITE_URL,
    convexUrl = env.EXPO_PUBLIC_CONVEX_URL,
}: {
    convexSiteUrl?: string;
    convexUrl?: string;
} = {}): CloudConfiguration {
    if (convexSiteUrl && convexUrl) {
        return "configured";
    }
    return convexSiteUrl || convexUrl ? "misconfigured" : "unconfigured";
}
