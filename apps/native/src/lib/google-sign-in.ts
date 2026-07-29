import { env } from "@outlayr/env/native";
import {
	GoogleOneTapSignIn,
	isNoSavedCredentialFoundResponse,
	isSuccessResponse,
} from "react-native-nitro-google-signin";

const webClientId = env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

/**
 * The web client id is what the backend verifies the id token against, so a
 * build without one can obtain a token no server will accept.
 */
export const isGoogleSignInAvailable = Boolean(webClientId);

/**
 * Resolves to the Google id token, or null when the user backed out — the three
 * calls are one flow, not three attempts: One Tap first, then account creation,
 * then the full picker, each only reached because the previous step found no
 * credential to offer.
 */
export async function googleIdToken(): Promise<string | null> {
	if (!webClientId) {
		return null;
	}

	GoogleOneTapSignIn.configure({
		webClientId,
		iosClientId: env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? null,
	});

	await GoogleOneTapSignIn.checkPlayServices();

	let response = await GoogleOneTapSignIn.signIn();
	if (isNoSavedCredentialFoundResponse(response)) {
		response = await GoogleOneTapSignIn.createAccount();
	}
	if (isNoSavedCredentialFoundResponse(response)) {
		response = await GoogleOneTapSignIn.presentExplicitSignIn();
	}

	return isSuccessResponse(response) ? response.data.idToken : null;
}
