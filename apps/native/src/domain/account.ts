import type { TranslateFn } from "@/i18n/context";

export interface AccountUser {
	email?: string | null;
	name?: string | null;
}

export type AccountState =
	| { kind: "pending" }
	| { kind: "signed-out" }
	| { kind: "signed-in"; user: AccountUser | undefined };

/**
 * Apple lets a user withhold both the name and the email, and Better Auth stores
 * whatever it was given, so neither field can be assumed present.
 */
export function accountLabel(user: AccountUser | undefined, t: TranslateFn): string {
	return firstNonBlank(user?.name, user?.email) ?? t("settings.account.signedInFallback");
}

export function accountRowValue(state: AccountState, t: TranslateFn): string {
	switch (state.kind) {
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

/**
 * Provider messages are developer-facing, not user-facing. Observed on a
 * simulator with no Apple account signed in:
 *
 *   RequestUnknownException: The authorization attempt failed for an unknown
 *   reason (at ExpoAppleAuthentication/AppleAuthenticationExceptions.swift:61)
 *
 * An earlier version passed that through on the reasoning that the OS had
 * already localized it. It had not, and a user cannot act on a Swift file path,
 * so the only thing shown is copy we wrote. The original is still worth having
 * when something is actually wrong, so callers log it.
 */
export function signInFailureMessage(error: unknown, t: TranslateFn): string {
	if (errorField(error, "code") === "PLAY_SERVICES_NOT_AVAILABLE") {
		return t("settings.account.playServices");
	}
	return t("settings.account.genericFailure");
}

/** The provider's own text, for a log line rather than a screen. */
export function signInFailureDetail(error: unknown): string | null {
	return firstNonBlank(errorField(error, "message"), errorField(error, "code"));
}

function errorField(error: unknown, field: string): string | null {
	if (typeof error !== "object" || error === null) {
		return null;
	}
	const value = (error as Record<string, unknown>)[field];
	return typeof value === "string" ? value : null;
}

function firstNonBlank(...values: (string | null | undefined)[]): string | null {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) {
			return trimmed;
		}
	}
	return null;
}
