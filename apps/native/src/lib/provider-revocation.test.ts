const mockSecureStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
	getItemAsync: async (key: string) => mockSecureStore.get(key) ?? null,
	setItemAsync: async (key: string, value: string) => {
		mockSecureStore.set(key, value);
	},
}));

const {
	legacyAppleReauthenticationSubject,
	persistGoogleLocalReceiptAfterRevocation,
	persistProviderBinding,
	providerBindingFor,
} = require("./provider-revocation") as typeof import("./provider-revocation");

beforeEach(() => {
	mockSecureStore.clear();
});

describe("legacy-apple-uses-accountId-and-mismatch-fails", () => {
	it("uses the linked Apple provider accountId instead of the Better Auth user id", () => {
		expect(
			legacyAppleReauthenticationSubject({ accountId: "apple-subject", providerId: "apple" }, "apple-subject")
		).toBe("apple-subject");
	});

	it("rejects a credential returned for another Apple subject", () => {
		expect(() =>
			legacyAppleReauthenticationSubject({ accountId: "apple-subject", providerId: "apple" }, "other-subject")
		).toThrow("linked Apple account");
	});

	it("legacy-apple-missing-token-stays-retryable", () => {
		expect(() => legacyAppleReauthenticationSubject(null, "apple-subject")).toThrow("requires reauthentication");
	});

	it("creates the local Google receipt only after successful native revocation", async () => {
		const calls: string[] = [];
		await persistGoogleLocalReceiptAfterRevocation(
			async () => {
				calls.push("revoke");
			},
			async () => {
				calls.push("receipt");
			}
		);
		expect(calls).toEqual(["revoke", "receipt"]);
		await expect(
			persistGoogleLocalReceiptAfterRevocation(
				async () => {
					throw new Error("offline");
				},
				async () => {
					calls.push("must-not-persist");
				}
			)
		).rejects.toThrow("offline");
		expect(calls).toEqual(["revoke", "receipt"]);
	});

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
