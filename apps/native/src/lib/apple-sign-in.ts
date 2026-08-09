import { AppleAuthenticationScope, signInAsync } from "expo-apple-authentication";

/**
 * Resolves to the Apple identity token. Null when Apple returned a credential
 * without one, which the caller must treat as "nothing happened" rather than as
 * a failure — a dismissed sheet rejects instead, and `isSignInCancellation`
 * sorts that from a real error.
 */
export async function appleIdToken(): Promise<string | null> {
	const credential = await signInAsync({
		requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
	});
	return credential.identityToken;
}
