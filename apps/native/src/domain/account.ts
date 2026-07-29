import type { TranslateFn } from "@/i18n/context";

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
export function accountLabel(
	user: AccountUser | undefined,
	t: TranslateFn,
): string {
	return (
		firstNonBlank(user?.name, user?.email) ??
		t("settings.account.signedInFallback")
	);
}

export function accountRowValue(state: AccountState, t: TranslateFn): string {
	switch (state.kind) {
		case "unavailable":
			return t("settings.account.unavailable");
		case "pending":
			return "";
		case "signed-out":
			return t("settings.account.notSignedIn");
		case "signed-in":
			return accountLabel(state.user, t);
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

export function signInFailureMessage(error: unknown, t: TranslateFn): string {
	if (errorField(error, "code") === "PLAY_SERVICES_NOT_AVAILABLE") {
		return t("settings.account.playServices");
	}
	// A provider's own message is already localized by the OS; only the fallback
	// is ours to translate.
	return (
		firstNonBlank(errorField(error, "message")) ??
		t("settings.account.genericFailure")
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
