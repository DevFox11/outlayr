import { z } from "zod";

import type { TranslateFn } from "@/i18n/context";

export interface AccountUser {
    email?: string | null;
    name?: string | null;
}

export type AccountState =
    | { kind: "pending" }
    | { kind: "signed-out" }
    | { kind: "signed-in"; user: AccountUser | undefined };

export function accountLabel(user: AccountUser | undefined, t: TranslateFn): string {
    return firstNonBlank(user?.name, user?.email) ?? t("settings.account.signedInFallback");
}

export function accountRowValue(state: AccountState, t: TranslateFn): string {
    if (state.kind === "pending") {
        return "";
    }
    if (state.kind === "signed-out") {
        return t("settings.account.signIn");
    }
    return accountLabel(state.user, t);
}

const CANCELLATION_CODES = new Set(["ERR_REQUEST_CANCELED", "SIGN_IN_CANCELLED"]);

export function isSignInCancellation(cause: unknown): boolean {
    const code = errorField(cause, "code");
    return code !== null && CANCELLATION_CODES.has(code);
}

export function signInFailureMessage(cause: unknown, t: TranslateFn): string {
    if (errorField(cause, "code") === "PLAY_SERVICES_NOT_AVAILABLE") {
        return t("settings.account.playServices");
    }
    return t("settings.account.genericFailure");
}

export function signInFailureDetail(cause: unknown): string | null {
    return firstNonBlank(errorField(cause, "message"), errorField(cause, "code"));
}

const providerFailure = z.object({
    code: z.string().optional(),
    message: z.string().optional(),
});

function errorField(cause: unknown, field: "code" | "message"): string | null {
    const parsed = providerFailure.safeParse(cause);
    return parsed.success ? (parsed.data[field] ?? null) : null;
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
