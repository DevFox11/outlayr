import { useState } from "react";
import { isSignInCancellation, signInFailureMessage } from "@/domain/account";
import { useTranslation } from "@/i18n";
import type { authClient } from "@/lib/auth-client";

type AuthClient = NonNullable<typeof authClient>;

export type SignInProvider = "apple" | "google";

export interface ProviderSignIn {
	busy: SignInProvider | null;
	error: string | null;
	start: (
		provider: SignInProvider,
		getToken: () => Promise<string | null>,
	) => void;
}

/**
 * Every exit from a provider sheet — token, dismissal, or failure — clears
 * `busy` through one `finally`, so no path can leave the button spinning.
 */
export function useProviderSignIn(client: AuthClient): ProviderSignIn {
	const t = useTranslation();
	const [busy, setBusy] = useState<SignInProvider | null>(null);
	const [error, setError] = useState<string | null>(null);

	const start = (
		provider: SignInProvider,
		getToken: () => Promise<string | null>,
	) => {
		setError(null);
		setBusy(provider);
		getToken()
			.then(async (token) => {
				if (!token) {
					return;
				}
				const { error: rejection } = await client.signIn.social({
					idToken: { token },
					provider,
				});
				if (rejection) {
					setError(signInFailureMessage(rejection, t));
				}
			})
			.catch((cause: unknown) => {
				if (!isSignInCancellation(cause)) {
					setError(signInFailureMessage(cause, t));
				}
			})
			.finally(() => setBusy(null));
	};

	return { busy, error, start };
}
