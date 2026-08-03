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

/** The one account-area screen the root stack admits once onboarding is done. */
export type AuthRoute = "sign-in" | "adopt" | "ledger";

export interface AccountState {
	gate: AuthGate;
	/** This device's ledger has been reconciled against the account's. */
	reconciled: boolean;
	/** The owner declined the account offer during first run. */
	deferred: boolean;
}

/**
 * `unconfigured` opens the ledger, and does so without consulting `reconciled`:
 * a build with no auth client holds no account to reconcile against, and its
 * sign-in screen renders no controls at all, so routing there strands the owner
 * outside their own local data with nothing to press and no route onward. This
 * is the contract `src/lib/auth-client.ts` states — signing in only ever adds
 * sync, so a missing backend must degrade to "no account available", never to a
 * gate.
 *
 * `deferred` opens it for the same reason from the other direction: the ledger
 * is local-first and already on the device, so someone who declined the offer in
 * first run owns data no account is holding. Only `reconciled` can gate a signed-in
 * device, because that is the one case where an account holds a second ledger.
 *
 * `restoring` parks on the sign-in screen rather than on nothing, because the
 * stack needs a screen admitted for the window in which the session is read;
 * `AuthCover` holds an opaque cover over it for exactly that window.
 */
export function authRoute(state: AccountState): AuthRoute {
	if (state.gate === "unconfigured") {
		return "ledger";
	}
	if (state.gate !== "signed-in") {
		return state.deferred ? "ledger" : "sign-in";
	}
	return state.reconciled ? "ledger" : "adopt";
}

export type RootStackGroup = "onboarding" | AuthRoute;

export function rootStackGroup(
	state: AccountState & { onboarded: boolean },
): RootStackGroup {
	return state.onboarded ? authRoute(state) : "onboarding";
}
