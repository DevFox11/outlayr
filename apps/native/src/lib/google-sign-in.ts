import { env } from "@outlayr/env/native";
import { GoogleOneTapSignIn, isSuccessResponse } from "react-native-nitro-google-signin";

import { duringHandoff } from "@/lib/app-handoff";

const webClientId = env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

/**
 * The web client id is what the backend verifies the id token against, so a
 * build without one can obtain a token no server will accept.
 */
export const isGoogleSignInAvailable = Boolean(webClientId);

export async function googleIdToken(): Promise<string | null> {
    if (!webClientId) {
        return null;
    }

    GoogleOneTapSignIn.configure({
        iosClientId: env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? null,
        webClientId,
    });

    await GoogleOneTapSignIn.checkPlayServices();

    const response = await duringHandoff(() => GoogleOneTapSignIn.presentExplicitSignIn());
    return isSuccessResponse(response) ? response.data.idToken : null;
}
