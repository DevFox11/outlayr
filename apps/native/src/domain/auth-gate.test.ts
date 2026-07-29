import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authGate } from "./auth-gate";

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
