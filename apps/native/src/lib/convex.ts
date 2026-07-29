import { env } from "@outlayr/env/native";
import { ConvexReactClient } from "convex/react";
import type { PullRatesFn } from "@/data/rates";

/**
 * The Convex client, or null when this build has no backend configured: this app
 * only reads exchange rates from Convex, so the URL is optional — see
 * `@outlayr/env/native`.
 */
export const convex = env.EXPO_PUBLIC_CONVEX_URL
	? new ConvexReactClient(env.EXPO_PUBLIC_CONVEX_URL, {
			unsavedChangesWarning: false,
		})
	: null;

/**
 * The rate snapshot fetcher, or null when there is no backend — returning null
 * rather than throwing lets the caller skip cleanly, so a missing backend
 * degrades to "no fresh rates" rather than to a crash.
 */
export function ratesPuller(): PullRatesFn | null {
	if (!convex) {
		return null;
	}
	return async (args) =>
		// Addressed by path rather than through the generated API:
		// `packages/backend` is not a build dependency of the app, and the wire
		// shape is pinned by `PullRatesPage` plus the backend's own tests.
		convex.query("exchangeRates:pullRates" as never, (args ?? {}) as never);
}
