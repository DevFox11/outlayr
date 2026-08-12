import { AppleAuthenticationScope, signInAsync } from "expo-apple-authentication";
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from "expo-crypto";

export interface AppleSignInCredential {
	authorizationCode: string;
	identityToken: string;
	nonce: string;
	providerSubject: string;
}

const BASE64_PADDING = /[=]+$/;

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return globalThis.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(BASE64_PADDING, "");
}

/**
 * Resolves to the Apple identity token. Null when Apple returned a credential
 * without one, which the caller must treat as "nothing happened" rather than as
 * a failure — a dismissed sheet rejects instead, and `isSignInCancellation`
 * sorts that from a real error.
 */
export async function appleIdToken(): Promise<string | null> {
	const credential = await appleCredential();
	return credential ? credential.identityToken : null;
}

export async function appleCredential(): Promise<AppleSignInCredential | null> {
	const nonce = base64Url(await getRandomBytesAsync(32));
	const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, nonce);
	const credential = await signInAsync({
		nonce: hashedNonce,
		requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
	});
	if (!(credential.identityToken && credential.authorizationCode && credential.user)) {
		return null;
	}
	return {
		authorizationCode: credential.authorizationCode,
		identityToken: credential.identityToken,
		nonce,
		providerSubject: credential.user,
	};
}
