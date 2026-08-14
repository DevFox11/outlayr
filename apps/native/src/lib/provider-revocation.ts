import { getItemAsync, setItemAsync } from "expo-secure-store";

export const PROVIDER_BINDING_KEY = "outlayr.provider-binding";

export interface ProviderBinding {
    betterAuthUserId: string;
    provider: "apple" | "google";
    providerSubject: string;
}

function isProviderBinding(value: unknown): value is ProviderBinding {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as ProviderBinding).betterAuthUserId === "string" &&
        (value as ProviderBinding).betterAuthUserId.length > 0 &&
        ((value as ProviderBinding).provider === "apple" || (value as ProviderBinding).provider === "google") &&
        typeof (value as ProviderBinding).providerSubject === "string" &&
        (value as ProviderBinding).providerSubject.length > 0
    );
}

/** Stores the provider identity only after the corresponding Better Auth session is established. */
export async function persistProviderBinding(binding: ProviderBinding): Promise<void> {
    if (!isProviderBinding(binding)) {
        throw new Error("Provider binding is invalid");
    }
    await setItemAsync(PROVIDER_BINDING_KEY, JSON.stringify(binding));
}

export function legacyAppleReauthenticationSubject(
    account: { accountId: string; providerId: string } | null,
    credentialSubject: string
): string {
    if (account?.providerId !== "apple" || !account.accountId) {
        throw new Error("Apple provider revocation requires reauthentication");
    }
    if (account.accountId !== credentialSubject) {
        throw new Error("Apple reauthentication does not match the linked Apple account");
    }
    return account.accountId;
}

export async function providerBindingFor(betterAuthUserId: string): Promise<ProviderBinding> {
    const raw = await getItemAsync(PROVIDER_BINDING_KEY);
    if (raw === null) {
        throw new Error("Provider revocation requires reauthentication");
    }
    let binding: unknown;
    try {
        binding = JSON.parse(raw);
    } catch (cause) {
        throw new Error("Provider revocation requires reauthentication", { cause });
    }
    if (!isProviderBinding(binding)) {
        throw new Error("Provider revocation requires reauthentication");
    }
    if (binding.betterAuthUserId !== betterAuthUserId) {
        throw new Error("Provider binding does not match this account");
    }
    return binding;
}

export async function revokeProviderAccess(betterAuthUserId: string): Promise<void> {
    const binding = await providerBindingFor(betterAuthUserId);
    if (binding.provider === "google") {
        await revokeGoogleProviderSubject(binding.providerSubject);
        return;
    }
    throw new Error("Apple provider revocation requires reauthentication");
}

export async function revokeGoogleProviderSubject(providerSubject: string): Promise<void> {
    const { GoogleOneTapSignIn } = await import("react-native-nitro-google-signin");
    await GoogleOneTapSignIn.revokeAccess(providerSubject);
}

export async function persistGoogleLocalReceiptAfterRevocation(
    revoke: () => Promise<void>,
    persistReceipt: () => Promise<void>
): Promise<void> {
    await revoke();
    await persistReceipt();
}
