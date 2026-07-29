import { resolveDeepLink } from "@/lib/deep-links";

/**
 * Translates every link arriving from outside the JS bundle — widgets, App
 * Intents, Siri, home screen quick actions — into an in-app route. Returning
 * `path` untouched when `resolveDeepLink` declines is what keeps ordinary in-app
 * and dev-client URLs flowing through unchanged; without it `outlayr://newExpense`
 * resolves as a literal path and lands on `+not-found`.
 */
export function redirectSystemPath({ path }: { path: string | null }) {
	if (!path) {
		return path;
	}
	return resolveDeepLink(path) ?? path;
}
