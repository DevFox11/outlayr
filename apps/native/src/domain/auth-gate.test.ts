import { authGate, authRoute } from "./auth-gate";

describe("auth gate", () => {
	it("opens on a restored session", () => {
		expect(
			authGate({
				configured: true,
				hasSession: true,
				restoring: false,
				restoreExpired: false,
			}),
		).toBe("signed-in");
	});

	it("opens on a cached session the client is still revalidating", () => {
		expect(
			authGate({
				configured: true,
				hasSession: true,
				restoring: true,
				restoreExpired: false,
			}),
		).toBe("signed-in");
	});

	it("opens on a cached session whose revalidation never answered", () => {
		expect(
			authGate({
				configured: true,
				hasSession: true,
				restoring: true,
				restoreExpired: true,
			}),
		).toBe("signed-in");
	});

	it("holds while a session that is not cached is still being read", () => {
		expect(
			authGate({
				configured: true,
				hasSession: false,
				restoring: true,
				restoreExpired: false,
			}),
		).toBe("restoring");
	});

	it("falls through to sign-in once the restore budget is spent", () => {
		expect(
			authGate({
				configured: true,
				hasSession: false,
				restoring: true,
				restoreExpired: true,
			}),
		).toBe("signed-out");
	});

	it("asks for a sign-in once the client answers with nothing", () => {
		expect(
			authGate({
				configured: true,
				hasSession: false,
				restoring: false,
				restoreExpired: false,
			}),
		).toBe("signed-out");
	});

	it("reports a build that cannot sign anyone in rather than opening", () => {
		expect(
			authGate({
				configured: false,
				hasSession: false,
				restoring: false,
				restoreExpired: false,
			}),
		).toBe("unconfigured");
		expect(
			authGate({
				configured: false,
				hasSession: false,
				restoring: true,
				restoreExpired: false,
			}),
		).toBe("unconfigured");
	});
});

describe("account routing", () => {
	const at = (
		gate: Parameters<typeof authRoute>[0]["gate"],
		reconciled: boolean,
		deferred = false,
	) => authRoute({ gate, reconciled, deferred });

	it("opens the ledger of a build that cannot sign anyone in", () => {
		expect(at("unconfigured", true)).toBe("ledger");
		expect(at("unconfigured", false)).toBe("ledger");
	});

	it("never sends a build that cannot sign anyone in to the sign-in screen", () => {
		expect(at("unconfigured", true)).not.toBe("sign-in");
		expect(at("unconfigured", false)).not.toBe("sign-in");
	});

	it("opens the ledger for an account whose ledger has been reconciled", () => {
		expect(at("signed-in", true)).toBe("ledger");
	});

	it("reconciles an account's ledger before opening it", () => {
		expect(at("signed-in", false)).toBe("adopt");
	});

	it("asks a signed-out device to sign in", () => {
		expect(at("signed-out", true)).toBe("sign-in");
		expect(at("signed-out", false)).toBe("sign-in");
	});

	it("parks a restore on the sign-in screen, which the cover hides", () => {
		expect(at("restoring", true)).toBe("sign-in");
		expect(at("restoring", false)).toBe("sign-in");
	});

	it("opens the ledger of a device that declined the account offer", () => {
		// The whole point of the offer being declinable: the ledger is already on
		// the device, so there is nothing left to gate on.
		expect(at("signed-out", false, true)).toBe("ledger");
		expect(at("restoring", false, true)).toBe("ledger");
	});

	it("still reconciles when a device that declined signs in later", () => {
		expect(at("signed-in", false, true)).toBe("adopt");
		expect(at("signed-in", true, true)).toBe("ledger");
	});
});
