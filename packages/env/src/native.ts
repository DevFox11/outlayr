import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
	z.url().refine((url) => new URL(url).hostname !== exampleHost, {
		message: `Replace the ${exampleHost} placeholder before running the app`,
	});

/**
 * `EXPO_PUBLIC_CONVEX_URL` is OPTIONAL here, where the react-native app requires
 * it. That app cannot start without Convex — its auth and sync live there. This
 * one is local-first with no accounts: the backend serves exchange rates and
 * nothing else, so a build without one still runs and simply cannot convert
 * currencies. Making it required would fail the whole app shut over a feature
 * that is an enhancement.
 */
export const env = createEnv({
	clientPrefix: "EXPO_PUBLIC_",
	client: {
		EXPO_PUBLIC_CONVEX_URL: convexUrlSchema("example.convex.cloud").optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
