import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	accountLabel,
	accountRowValue,
	isSignInCancellation,
	signInFailureMessage,
} from "./account";

describe("account label", () => {
	it("prefers the name the provider gave", () => {
		assert.equal(
			accountLabel({ name: "Ada Lovelace", email: "ada@example.com" }),
			"Ada Lovelace",
		);
	});

	it("falls back to the email when the name is blank", () => {
		assert.equal(
			accountLabel({ name: "   ", email: "ada@example.com" }),
			"ada@example.com",
		);
	});

	it("stays readable when Apple withheld both", () => {
		assert.equal(accountLabel({ name: null, email: null }), "Signed in");
		assert.equal(accountLabel(undefined), "Signed in");
	});
});

describe("settings row value", () => {
	it("names the account once it is known", () => {
		assert.equal(
			accountRowValue({
				kind: "signed-in",
				user: { name: null, email: "ada@example.com" },
			}),
			"ada@example.com",
		);
	});

	it("says so plainly when signed out", () => {
		assert.equal(accountRowValue({ kind: "signed-out" }), "Not signed in");
	});

	it("shows nothing while the session is still restoring", () => {
		assert.equal(accountRowValue({ kind: "pending" }), "");
	});

	it("admits when the build has no backend", () => {
		assert.equal(accountRowValue({ kind: "unavailable" }), "Unavailable");
	});
});

describe("sign-in cancellation", () => {
	it("recognises a dismissed Apple sheet", () => {
		assert.equal(isSignInCancellation({ code: "ERR_REQUEST_CANCELED" }), true);
	});

	it("recognises a dismissed Google sheet", () => {
		assert.equal(isSignInCancellation({ code: "SIGN_IN_CANCELLED" }), true);
	});

	it("does not swallow a real failure", () => {
		assert.equal(
			isSignInCancellation({ code: "PLAY_SERVICES_NOT_AVAILABLE" }),
			false,
		);
		assert.equal(isSignInCancellation(new Error("network down")), false);
		assert.equal(isSignInCancellation(null), false);
		assert.equal(isSignInCancellation("ERR_REQUEST_CANCELED"), false);
	});
});

describe("sign-in failure message", () => {
	it("explains the one cause the user can act on", () => {
		assert.match(
			signInFailureMessage({ code: "PLAY_SERVICES_NOT_AVAILABLE" }),
			/Google Play services/,
		);
	});

	it("carries the server's own wording when there is one", () => {
		assert.equal(
			signInFailureMessage({ message: "Account already linked" }),
			"Account already linked",
		);
	});

	it("never renders an empty or undefined string", () => {
		for (const error of [null, undefined, {}, { message: "  " }, 42]) {
			const message = signInFailureMessage(error);
			assert.ok(message.trim().length > 0);
			assert.doesNotMatch(message, /undefined/);
		}
	});
});
