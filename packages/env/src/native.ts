import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
	z.url().refine((url) => new URL(url).hostname !== exampleHost, {
		message: `Replace the ${exampleHost} placeholder before running the app`,
	});

/**
 * Every variable is OPTIONAL here, where the react-native app requires them.
 * That app cannot start without Convex — its auth and sync live there. This one
 * is local-first: SQLite is the source of truth, the backend serves exchange
 * rates, and signing in is an opt-in that only unlocks sync. A build without any
 * of these still runs; it simply cannot convert currencies or offer an account.
 * Making them required would fail the whole app shut over enhancements.
 *
 * `EXPO_PUBLIC_CONVEX_SITE_URL` is the deployment's `.convex.site` HTTP origin,
 * not the `.convex.cloud` websocket one in `EXPO_PUBLIC_CONVEX_URL`: Better Auth
 * routes are served by `http.ts`, which only exists on the site domain.
 */
export const env = createEnv({
	clientPrefix: "EXPO_PUBLIC_",
	client: {
		EXPO_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud").optional(),
		EXPO_PUBLIC_CONVEX_SITE_URL: convexUrlSchema(
			"example.convex.site",
		).optional(),
		EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: z.string().optional(),
		EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
