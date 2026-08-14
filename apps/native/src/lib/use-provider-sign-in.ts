import { useState } from "react";

import { isSignInCancellation, signInFailureDetail, signInFailureMessage } from "@/domain/account";
import { useTranslation } from "@/i18n/context";
import type { AppleSignInCredential } from "@/lib/apple-sign-in";
import type { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/lib/auth-session";
import { persistProviderBinding } from "@/lib/provider-revocation";

type AuthClient = NonNullable<typeof authClient>;

export type SignInProvider = "apple" | "google";

export interface ProviderSignIn {
    busy: SignInProvider | null;
    error: string | null;
    start: (provider: SignInProvider, getCredential: () => Promise<AppleSignInCredential | string | null>) => void;
}

type Activation = Pick<ReturnType<typeof useAuthSession>, "activate" | "begin" | "reject">;
interface ProviderSignInOptions {
    onAppleFailure?: () => Promise<void>;
}

interface SocialSignInResult {
    data?: { user?: { id?: unknown } } | null;
    error?: { message?: string } | null;
}

function betterAuthUserId(result: SocialSignInResult): string {
    const userId = result.data?.user?.id;
    if (typeof userId !== "string" || userId.length === 0) {
        throw new Error("Provider sign-in did not return a Better Auth user");
    }
    return userId;
}

export function googleProviderSubject(identityToken: string): string {
    const [, payload] = identityToken.split(".");
    if (!payload) {
        throw new Error("Google sign-in did not return a valid identity token");
    }
    try {
        const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const subject: unknown = JSON.parse(globalThis.atob(padded)).sub;
        if (typeof subject !== "string" || subject.length === 0) {
            throw new Error("Google identity token does not contain a subject");
        }
        return subject;
    } catch (cause) {
        if (cause instanceof Error && cause.message === "Google identity token does not contain a subject") {
            throw cause;
        }
        throw new Error("Google sign-in did not return a valid identity token", { cause });
    }
}

export async function completeAppleSignIn(
    client: AuthClient,
    activation: Activation,
    credential: AppleSignInCredential,
    onFailure?: () => Promise<void>
): Promise<void> {
    activation.begin();
    try {
        const result = (await client.signIn.social({
            idToken: { nonce: credential.nonce, token: credential.identityToken },
            provider: "apple",
        })) as SocialSignInResult;
        const { error: rejection } = result;
        if (rejection) {
            throw new Error(rejection.message);
        }
        const userId = betterAuthUserId(result);
        const grantResult = await client.$fetch("/apple/grant", {
            body: credential,
            method: "POST",
        });
        const active =
            typeof grantResult.data === "object" &&
            grantResult.data !== null &&
            "active" in grantResult.data &&
            grantResult.data.active === true;
        if (grantResult.error || !active) {
            throw new Error(grantResult.error?.message ?? "Apple credential activation failed");
        }
        await persistProviderBinding({
            betterAuthUserId: userId,
            provider: "apple",
            providerSubject: credential.providerSubject,
        });
        activation.activate();
    } catch (cause) {
        await client.signOut?.();
        activation.reject();
        await onFailure?.();
        throw cause;
    }
}

export async function completeGoogleSignIn(client: AuthClient, identityToken: string): Promise<void> {
    const result = (await client.signIn.social({
        idToken: { token: identityToken },
        provider: "google",
    })) as SocialSignInResult;
    if (result.error) {
        throw new Error(result.error.message);
    }
    await persistProviderBinding({
        betterAuthUserId: betterAuthUserId(result),
        provider: "google",
        providerSubject: googleProviderSubject(identityToken),
    });
}

/**
 * Every exit from a provider sheet — token, dismissal, or failure — clears
 * `busy` through one `finally`, so no path can leave the button spinning.
 */
export function useProviderSignIn(client: AuthClient, options: ProviderSignInOptions = {}): ProviderSignIn {
    const t = useTranslation();
    const activation = useAuthSession();
    const [busy, setBusy] = useState<SignInProvider | null>(null);
    const [error, setError] = useState<string | null>(null);

    const start = (provider: SignInProvider, getCredential: () => Promise<AppleSignInCredential | string | null>) => {
        setError(null);
        setBusy(provider);
        getCredential()
            .then(async (credential) => {
                if (!credential) {
                    return;
                }
                if (provider === "apple") {
                    if (typeof credential === "string") {
                        throw new TypeError("Apple sign-in did not return a credential");
                    }
                    await completeAppleSignIn(client, activation, credential, options.onAppleFailure);
                    return;
                }
                if (typeof credential !== "string") {
                    throw new TypeError("Google sign-in did not return an identity token");
                }
                await completeGoogleSignIn(client, credential);
            })
            .catch((cause: unknown) => {
                if (!isSignInCancellation(cause)) {
                    console.warn("[outlayr] sign-in failed", signInFailureDetail(cause));
                    setError(signInFailureMessage(cause, t));
                }
            })
            .finally(() => setBusy(null));
    };

    return { busy, error, start };
}
