import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { env } from "@outlayr/env/native";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import { getItem, setItem } from "expo-secure-store";
import { convex } from "@/lib/convex";

/**
 * `scheme` is typed `string | string[]` because a config may declare several.
 * Better Auth needs the one it hands the provider as a redirect target, so only
 * a single declared scheme is usable.
 */
function callbackScheme(): string | null {
	const scheme = Constants.expoConfig?.scheme;
	return typeof scheme === "string" ? scheme : null;
}

const scheme = callbackScheme();

/**
 * Null when this build cannot offer an account: no Convex client, no site URL,
 * or no single URL scheme to come back to. Every caller branches on it rather
 * than assuming a session exists — the ledger is local-first and signing in
 * only ever adds sync, so an unconfigured build must degrade to "no account
 * available", never to a crash or a gate.
 *
 * A module constant, so the branch is stable for the process lifetime and a
 * component may return early on it before calling hooks.
 */
export const authClient =
	convex && env.EXPO_PUBLIC_CONVEX_SITE_URL && scheme
		? createAuthClient({
				baseURL: env.EXPO_PUBLIC_CONVEX_SITE_URL,
				plugins: [
					convexClient(),
					expoClient({
						scheme,
						storagePrefix: scheme,
						storage: { getItem, setItem },
					}),
				],
			})
		: null;
