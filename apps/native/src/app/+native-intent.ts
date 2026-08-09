import { clearInitialURL } from "expo-linking";

import { redirectLaunchPath } from "@/lib/deep-links";

/**
 * Translates every link arriving from outside the JS bundle — widgets, App
 * Intents, Siri, home screen quick actions — into an in-app route. Returning
 * `path` untouched when `resolveDeepLink` declines is what keeps ordinary in-app
 * and dev-client URLs flowing through unchanged; without it `outlayr://newExpense`
 * resolves as a literal path and lands on `+not-found`.
 */
export function redirectSystemPath(event: { path: string | null; initial: boolean }) {
	return redirectLaunchPath(event, drainLaunchURL);
}

/**
 * Gated because the replay it prevents needs `ExpoRoot` to re-mount, which only
 * a dev reload does, and a drained registry cannot be recovered if expo-router
 * ever reads the launch URL later than it does today.
 */
function drainLaunchURL() {
	if (__DEV__) {
		clearInitialURL();
	}
}
