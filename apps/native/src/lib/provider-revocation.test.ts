import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockSecureStore = new Map<string, string>();

jest.mock<Partial<typeof import("expo-secure-store")>>("expo-secure-store", () => ({
    getItemAsync: async (key: string) => mockSecureStore.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
        mockSecureStore.set(key, value);
    },
}));

const { persistProviderBinding, providerBindingFor } =
    require("./provider-revocation") as typeof import("./provider-revocation");

beforeEach(() => {
    mockSecureStore.clear();
});

describe("provider binding", () => {
    it("makes a validated provider sign-in binding available for later deletion", async () => {
        await persistProviderBinding({
            betterAuthUserId: "better-auth-user",
            provider: "google",
            providerSubject: "google-subject",
        });

        await expect(providerBindingFor("better-auth-user")).resolves.toStrictEqual({
            betterAuthUserId: "better-auth-user",
            provider: "google",
            providerSubject: "google-subject",
        });
    });
});
