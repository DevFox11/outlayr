export interface AccountUser {
	name?: string | null;
	email?: string | null;
}

export type AccountState =
	/** No backend configured in this build — see `src/lib/auth-client.ts`. */
	| { kind: "unavailable" }
	| { kind: "pending" }
	| { kind: "signed-out" }
	| { kind: "signed-in"; user: AccountUser | undefined };

/**
 * Apple lets a user withhold both the name and the email, and Better Auth stores
 * whatever it was given, so neither field can be assumed present.
 */
export function accountLabel(user: AccountUser | undefined): string {
	return firstNonBlank(user?.name, user?.email) ?? "Signed in";
}

export function accountRowValue(state: AccountState): string {
	switch (state.kind) {
		case "unavailable":
			return "Unavailable";
		case "pending":
			return "";
		case "signed-out":
			return "Not signed in";
		case "signed-in":
			return accountLabel(state.user);
	}
}

const CANCELLATION_CODES = new Set([
	// expo-apple-authentication
	"ERR_REQUEST_CANCELED",
	// react-native-nitro-google-signin
	"SIGN_IN_CANCELLED",
]);

/**
 * A dismissed provider sheet arrives as a rejection, not a result. Treating it
 * as a failure would put an error on screen for a user who simply changed their
 * mind.
 */
export function isSignInCancellation(error: unknown): boolean {
	const code = errorField(error, "code");
	return code !== null && CANCELLATION_CODES.has(code);
}

export function signInFailureMessage(error: unknown): string {
	if (errorField(error, "code") === "PLAY_SERVICES_NOT_AVAILABLE") {
		return "Google Play services are unavailable on this device.";
	}
	return (
		firstNonBlank(errorField(error, "message")) ??
		"Sign-in didn't complete. Your ledger on this device is untouched."
	);
}

function errorField(error: unknown, field: string): string | null {
	if (typeof error !== "object" || error === null) {
		return null;
	}
	const value = (error as Record<string, unknown>)[field];
	return typeof value === "string" ? value : null;
}

function firstNonBlank(
	...values: (string | null | undefined)[]
): string | null {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) {
			return trimmed;
		}
	}
	return null;
}
