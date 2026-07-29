import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	lockFailureMessage,
	lockGate,
	lockIsUnenforceable,
	relocksOnPhase,
} from "./app-lock";

describe("app lock gate", () => {
	it("stays open while the setting is off", () => {
		assert.equal(lockGate(false, false, null), "open");
		assert.equal(lockGate(false, false, true), "open");
	});

	it("is shut on the frame before the enrolment probe answers", () => {
		assert.equal(lockGate(true, false, null), "shut");
	});

	it("opens once the session is authenticated", () => {
		assert.equal(lockGate(true, true, true), "open");
	});

	it("opens on a device that could never answer the prompt", () => {
		assert.equal(lockGate(true, false, false), "open");
	});
});

describe("app lock re-arming", () => {
	it("re-arms on inactive, not just background", () => {
		assert.equal(relocksOnPhase("inactive"), true);
		assert.equal(relocksOnPhase("background"), true);
	});

	it("does not re-arm while the app is in front", () => {
		assert.equal(relocksOnPhase("active"), false);
	});
});

describe("app lock failures", () => {
	it("says nothing when the user backed out of the prompt", () => {
		assert.equal(lockFailureMessage("user_cancel"), null);
		assert.equal(lockFailureMessage("app_cancel"), null);
		assert.equal(lockFailureMessage("system_cancel"), null);
	});

	it("explains every other failure", () => {
		for (const error of [
			"lockout",
			"authentication_failed",
			"timeout",
			"unable_to_process",
			"unknown",
			"invalid_context",
			"no_space",
			"user_fallback",
		] as const) {
			const message = lockFailureMessage(error);
			assert.ok(message, `${error} has no copy`);
		}
	});

	it("treats a device that cannot answer as unenforceable", () => {
		assert.equal(lockIsUnenforceable("not_enrolled"), true);
		assert.equal(lockIsUnenforceable("not_available"), true);
		assert.equal(lockIsUnenforceable("passcode_not_set"), true);
	});

	it("keeps a hardware lockout enforceable, since the passcode still answers", () => {
		assert.equal(lockIsUnenforceable("lockout"), false);
		assert.equal(lockIsUnenforceable("authentication_failed"), false);
		assert.equal(lockIsUnenforceable("user_cancel"), false);
	});
});
