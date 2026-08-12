import { appleCredential } from "./apple-sign-in";

jest.mock("expo-apple-authentication", () => ({
	AppleAuthenticationScope: { EMAIL: "email", FULL_NAME: "full-name" },
	signInAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
	CryptoDigestAlgorithm: { SHA256: "SHA256" },
	digestStringAsync: jest.fn(),
	getRandomBytesAsync: jest.fn(),
}));

const apple = jest.requireMock("expo-apple-authentication") as { signInAsync: jest.Mock };
const crypto = jest.requireMock("expo-crypto") as {
	digestStringAsync: jest.Mock;
	getRandomBytesAsync: jest.Mock;
};

describe("apple-nonce-binds-once", () => {
	it("passes only the SHA-256 nonce to Apple while retaining raw nonce for Better Auth", async () => {
		crypto.getRandomBytesAsync.mockResolvedValue(Uint8Array.from([0, 1, 2]));
		crypto.digestStringAsync.mockResolvedValue("hashed-nonce");
		apple.signInAsync.mockResolvedValue({
			authorizationCode: "authorization-code",
			identityToken: "identity-token",
			user: "apple-subject",
		});

		await expect(appleCredential()).resolves.toEqual({
			authorizationCode: "authorization-code",
			identityToken: "identity-token",
			nonce: "AAEC",
			providerSubject: "apple-subject",
		});
		expect(crypto.digestStringAsync).toHaveBeenCalledWith("SHA256", "AAEC");
		expect(apple.signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: "hashed-nonce" }));
	});
});
