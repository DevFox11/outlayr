import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
	z.url().refine((url) => new URL(url).hostname !== exampleHost, {
		message: `Replace the ${exampleHost} placeholder before running the app`,
	});

/**
 * Convex is REQUIRED: auth and sync live there, and both are mounted
 * unconditionally, so a build without a deployment cannot start. Validation
 * happens at import time, which means a missing URL fails loudly at boot rather
 * than at the first query. Everything below it stays optional and degrades.
 *
 * `EXPO_PUBLIC_CONVEX_SITE_URL` is the deployment's `.convex.site` HTTP origin,
 * not the `.convex.cloud` websocket one in `EXPO_PUBLIC_CONVEX_URL`: Better Auth
 * routes are served by `http.ts`, which only exists on the site domain.
 */
export const env = createEnv({
	client: {
		EXPO_PUBLIC_CONVEX_SITE_URL: convexUrlSchema("example.convex.site"),
		EXPO_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud"),
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
