import { describe, expect, test, vi } from "vitest";

import { grantAppleCredential, refreshAppleCredential } from "./providerLifecycle";

const input = {
	authorizationCode: "code",
	identityToken: "identity-token",
	nonce: "raw-nonce",
	providerSubject: "apple-subject",
};

const now = new Date("2026-08-11T12:00:00.000Z");

function dependencies() {
	return {
		exchange: vi.fn().mockResolvedValue({
			accessToken: "access",
			expiresIn: 3600,
			idToken: "exchange-id",
			refreshToken: "refresh",
		}),
		findAppleAccount: vi.fn().mockResolvedValue({
			accessTokenExpiresAt: new Date("2026-08-11T11:00:00.000Z"),
			accountId: "apple-subject",
			id: "account-id",
			refreshToken: "encrypted-existing-refresh",
			updatedAt: new Date("2026-08-10T12:00:00.000Z"),
		}),
		persist: vi.fn().mockResolvedValue(undefined),
		refresh: vi.fn().mockResolvedValue({
			accessToken: "rotated-access",
			expiresIn: 7200,
			idToken: "refresh-id",
		}),
		revoke: vi.fn().mockResolvedValue(undefined),
		verify: vi.fn().mockResolvedValue({ subject: "apple-subject" }),
	};
}

describe("apple-capture-exchange-storage", () => {
	test("stores only server-exchanged provider material and expiry after both subject checks", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const deps = dependencies();

		await expect(grantAppleCredential("user-id", input, deps)).resolves.toEqual({ active: true });

		expect(deps.verify).toHaveBeenNthCalledWith(1, "identity-token", "raw-nonce");
		expect(deps.exchange).toHaveBeenCalledWith("code");
		expect(deps.verify).toHaveBeenNthCalledWith(2, "exchange-id");
		expect(deps.persist).toHaveBeenCalledWith("account-id", {
			accessToken: "access",
			accessTokenExpiresAt: new Date("2026-08-11T13:00:00.000Z"),
			refreshToken: "refresh",
		});
		vi.useRealTimers();
	});

	test("rejects a linked-subject mismatch and never exchanges or persists", async () => {
		const deps = dependencies();
		deps.findAppleAccount.mockResolvedValue({ accountId: "other-subject", id: "account-id" });

		await expect(grantAppleCredential("user-id", input, deps)).rejects.toThrow("linked Apple account");

		expect(deps.exchange).not.toHaveBeenCalled();
		expect(deps.persist).not.toHaveBeenCalled();
	});

	test("best-effort revokes exchanged material when persistence fails", async () => {
		const deps = dependencies();
		deps.persist.mockRejectedValue(new Error("storage unavailable"));

		await expect(grantAppleCredential("user-id", input, deps)).rejects.toThrow("storage unavailable");

		expect(deps.revoke).toHaveBeenCalledWith("refresh");
	});
});

describe("apple-refresh-rotation", () => {
	test("rotates access and expiry atomically while retaining an omitted refresh token", async () => {
		const deps = dependencies();

		await expect(refreshAppleCredential("user-id", deps, now)).resolves.toEqual({ active: true, refreshed: true });

		expect(deps.refresh).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: "encrypted-existing-refresh" }));
		expect(deps.verify).toHaveBeenCalledWith("refresh-id");
		expect(deps.persist).toHaveBeenCalledWith(
			"account-id",
			{
				accessToken: "rotated-access",
				accessTokenExpiresAt: new Date("2026-08-11T14:00:00.000Z"),
				refreshToken: undefined,
			},
			"encrypted-existing-refresh"
		);
	});

	test("fails closed and revokes a rotated refresh token on subject or persistence mismatch", async () => {
		const deps = dependencies();
		deps.refresh.mockResolvedValue({
			accessToken: "rotated-access",
			expiresIn: 7200,
			idToken: "wrong-subject-id",
			refreshToken: "replacement-refresh",
		});
		deps.verify.mockResolvedValue({ subject: "other-subject" });

		await expect(refreshAppleCredential("user-id", deps, now)).rejects.toThrow("linked Apple account");

		expect(deps.persist).not.toHaveBeenCalled();
		expect(deps.revoke).toHaveBeenCalledWith("replacement-refresh");
	});

	test("revokes newly received refresh material when atomic persistence fails", async () => {
		const deps = dependencies();
		deps.refresh.mockResolvedValue({
			accessToken: "rotated-access",
			expiresIn: 7200,
			idToken: "refresh-id",
			refreshToken: "replacement-refresh",
		});
		deps.persist.mockRejectedValue(new Error("storage unavailable"));

		await expect(refreshAppleCredential("user-id", deps, now)).rejects.toThrow("storage unavailable");

		expect(deps.revoke).toHaveBeenCalledWith("replacement-refresh");
	});

	test("does not refresh more than once per day", async () => {
		const deps = dependencies();
		deps.findAppleAccount.mockResolvedValue({
			accessTokenExpiresAt: new Date("2026-08-11T14:00:00.000Z"),
			accountId: "apple-subject",
			id: "account-id",
			refreshToken: "encrypted-existing-refresh",
			updatedAt: new Date("2026-08-11T11:00:00.000Z"),
		});

		await expect(refreshAppleCredential("user-id", deps, now)).resolves.toEqual({ active: true, refreshed: false });

		expect(deps.refresh).not.toHaveBeenCalled();
		expect(deps.persist).not.toHaveBeenCalled();
	});
});
