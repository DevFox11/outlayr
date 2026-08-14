import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Every variable is optional because the deployment must boot without them: the
 * exchange-rate functions and the sync tables are useful signed out, and a
 * required var here would fail the whole deployment shut over a provider that
 * has not been provisioned yet. `auth.ts` degrades each provider individually
 * instead — see the `appleConfig`/`googleConfig` guards there.
 */
export const env = createEnv({
    emptyStringAsUndefined: true,
    // env-core's `typeof window` heuristic misclassifies runtimes that expose a
    // `window` (vitest's edge-runtime, which is what convex-test runs in) as a
    // client and blocks every server-var read at import time.
    isServer: true,
    runtimeEnv: process.env,
    server: {
        APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
        APPLE_CLIENT_ID: z.string().optional(),
        APPLE_KEY_ID: z.string().optional(),
        APPLE_PRIVATE_KEY: z.string().optional(),
        APPLE_TEAM_ID: z.string().optional(),
        GOOGLE_CLIENT_ID_IOS: z.string().optional(),
        GOOGLE_CLIENT_ID_WEB: z.string().optional(),
        GOOGLE_CLIENT_SECRET: z.string().optional(),
        XAI_API_KEY: z.string().optional(),
        XAI_MODEL_ID: z.string().optional(),
    },
});
