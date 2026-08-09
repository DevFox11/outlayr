import type { LocalDataStatus } from "@/contexts/local-data-context";
import type { AdoptionStatus } from "@/lib/ledger-adoption";
import type { AuthGate } from "./auth-gate";

export interface ShellProbe {
	data: LocalDataStatus;
	fontsLoaded: boolean;
	languageReady: boolean;
}

/**
 * Whether the tree that reads the database may mount. `error` is excluded on
 * purpose: it is its own surface, not a later frame of this one.
 */
export function localShellReady(probe: ShellProbe): boolean {
	return probe.fontsLoaded && probe.languageReady && probe.data === "ready";
}

export interface RouteProbe {
	adoption: AdoptionStatus;
	gate: AuthGate;
}

/**
 * Whether `rootStackGroup` can name the destination yet. Both holds are bounded
 * elsewhere — `restoring` by `AUTH_RESTORE_BUDGET_MS`, `resolving` by an
 * adoption run that settles even when it throws — so this can never stall.
 *
 * `ask` settles: the adopt screen is a destination, and holding the splash over
 * it would hide the only question that moves the app forward.
 */
export function routeSettled(probe: RouteProbe): boolean {
	return probe.gate !== "restoring" && probe.adoption !== "resolving";
}
