import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authGate, authRoute } from "./auth-gate";

describe("auth gate", () => {
	it("opens on a restored session", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: true,
				restoring: false,
				restoreExpired: false,
			}),
			"signed-in",
		);
	});

	it("opens on a cached session the client is still revalidating", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: true,
				restoring: true,
				restoreExpired: false,
			}),
			"signed-in",
		);
	});

	it("opens on a cached session whose revalidation never answered", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: true,
				restoring: true,
				restoreExpired: true,
			}),
			"signed-in",
		);
	});

	it("holds while a session that is not cached is still being read", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: false,
				restoring: true,
				restoreExpired: false,
			}),
			"restoring",
		);
	});

	it("falls through to sign-in once the restore budget is spent", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: false,
				restoring: true,
				restoreExpired: true,
			}),
			"signed-out",
		);
	});

	it("asks for a sign-in once the client answers with nothing", () => {
		assert.equal(
			authGate({
				configured: true,
				hasSession: false,
				restoring: false,
				restoreExpired: false,
			}),
			"signed-out",
		);
	});

	it("reports a build that cannot sign anyone in rather than opening", () => {
		assert.equal(
			authGate({
				configured: false,
				hasSession: false,
				restoring: false,
				restoreExpired: false,
			}),
			"unconfigured",
		);
		assert.equal(
			authGate({
				configured: false,
				hasSession: false,
				restoring: true,
				restoreExpired: false,
			}),
			"unconfigured",
		);
	});
});

describe("account routing", () => {
	it("opens the ledger of a build that cannot sign anyone in", () => {
		assert.equal(authRoute("unconfigured", true), "ledger");
		assert.equal(authRoute("unconfigured", false), "ledger");
	});

	it("never sends a build that cannot sign anyone in to the sign-in screen", () => {
		assert.notEqual(authRoute("unconfigured", true), "sign-in");
		assert.notEqual(authRoute("unconfigured", false), "sign-in");
	});

	it("opens the ledger for an account whose ledger has been reconciled", () => {
		assert.equal(authRoute("signed-in", true), "ledger");
	});

	it("reconciles an account's ledger before opening it", () => {
		assert.equal(authRoute("signed-in", false), "adopt");
	});

	it("asks a signed-out device to sign in", () => {
		assert.equal(authRoute("signed-out", true), "sign-in");
		assert.equal(authRoute("signed-out", false), "sign-in");
	});

	it("parks a restore on the sign-in screen, which the cover hides", () => {
		assert.equal(authRoute("restoring", true), "sign-in");
		assert.equal(authRoute("restoring", false), "sign-in");
	});
});
