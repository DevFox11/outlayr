import type { LocalAuthenticationError } from "expo-local-authentication";
import type { AppStateStatus } from "react-native";

export type LockGate = "open" | "shut";

/**
 * `inactive` counts: iOS takes the app-switcher snapshot during it, so waiting
 * for `background` would publish a thumbnail of the ledger.
 */
export function relocksOnPhase(phase: AppStateStatus): boolean {
	return phase !== "active";
}

/**
 * `enforceable` is `null` until the enrolment probe answers, and the gate is
 * shut for that frame — a first paint that shows the ledger and covers it a
 * moment later has already leaked it.
 *
 * A device with nothing enrolled resolves to `false` and the gate opens.
 * Swift instead bounced to Settings and left `isAppUnLocked` false
 * (`AppLockViewModel.swift:97-102`), which strands the owner outside their own
 * local ledger with no way back in.
 */
export function lockGate(
	enabled: boolean,
	unlocked: boolean,
	enforceable: boolean | null,
): LockGate {
	if (!enabled || enforceable === false) {
		return "open";
	}
	return unlocked ? "open" : "shut";
}

/**
 * Whether this failure means the device can never satisfy the prompt. A
 * `lockout` is not one of them: the passcode fallback still answers, so a
 * retry can still get in.
 */
export function lockIsUnenforceable(error: LocalAuthenticationError): boolean {
	return (
		error === "not_enrolled" ||
		error === "not_available" ||
		error === "passcode_not_set"
	);
}

/** `null` where the user dismissed the prompt themselves — nothing went wrong. */
export function lockFailureMessage(
	error: LocalAuthenticationError,
): string | null {
	switch (error) {
		case "user_cancel":
		case "app_cancel":
		case "system_cancel":
			return null;
		case "lockout":
			return "Too many attempts. Unlock with your device passcode instead.";
		case "authentication_failed":
			return "That did not match. Try again.";
		case "user_fallback":
			return "Choose Unlock again to enter your device passcode.";
		case "not_enrolled":
		case "not_available":
		case "passcode_not_set":
			return "This device has no passcode or biometrics set up.";
		case "timeout":
			return "The prompt timed out. Try again.";
		default:
			return "Could not check. Try again.";
	}
}
