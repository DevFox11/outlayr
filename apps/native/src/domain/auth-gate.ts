export type AuthGate =
	/** No session is cached and none has been read yet. Cover, do not decide. */
	| "restoring"
	| "signed-in"
	| "signed-out"
	/** This build has no auth client at all — see `src/lib/auth-client.ts`. */
	| "unconfigured";

export interface AuthProbe {
	configured: boolean;
	hasSession: boolean;
	restoring: boolean;
	restoreExpired: boolean;
}

/**
 * How long a cold start waits for a session it has no cached copy of before it
 * shows the sign-in screen. Spending it costs a signed-out user nothing — they
 * are going to that screen anyway — and it is the only thing standing between a
 * dead network and an indefinite spinner.
 */
export const AUTH_RESTORE_BUDGET_MS = 6000;

/**
 * A cached session wins over every other signal, which is what makes an
 * authenticated cold start work with no network at all: `expoClient` seeds the
 * session atom straight out of the secure store while the client is being
 * constructed (`@better-auth/expo/dist/client.js`, `getActions`), so a device
 * that has signed in already reads `hasSession` on its first frame and the
 * revalidation that follows can fail freely.
 *
 * The ledger is still local-first — SQLite answers every read — so the only
 * thing the network could add here is a reason to lock someone out of data they
 * already hold.
 */
export function authGate(probe: AuthProbe): AuthGate {
	if (!probe.configured) {
		return "unconfigured";
	}
	if (probe.hasSession) {
		return "signed-in";
	}
	if (probe.restoring && !probe.restoreExpired) {
		return "restoring";
	}
	return "signed-out";
}
