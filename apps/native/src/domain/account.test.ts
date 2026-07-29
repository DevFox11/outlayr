import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import {
	accountLabel,
	accountRowValue,
	isSignInCancellation,
	signInFailureDetail,
	signInFailureMessage,
} from "./account";

const t: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

describe("account label", () => {
	it("prefers the name the provider gave", () => {
		assert.equal(
			accountLabel({ name: "Ada Lovelace", email: "ada@example.com" }, t),
			"Ada Lovelace",
		);
	});

	it("falls back to the email when the name is blank", () => {
		assert.equal(
			accountLabel({ name: "   ", email: "ada@example.com" }, t),
			"ada@example.com",
		);
	});

	it("stays readable when Apple withheld both", () => {
		assert.equal(accountLabel({ name: null, email: null }, t), "Signed in");
		assert.equal(accountLabel(undefined, t), "Signed in");
	});
});

describe("settings row value", () => {
	it("names the account once it is known", () => {
		assert.equal(
			accountRowValue(
				{
					kind: "signed-in",
					user: { name: null, email: "ada@example.com" },
				},
				t,
			),
			"ada@example.com",
		);
	});

	it("says so plainly when signed out", () => {
		assert.equal(accountRowValue({ kind: "signed-out" }, t), "Not signed in");
	});

	it("shows nothing while the session is still restoring", () => {
		assert.equal(accountRowValue({ kind: "pending" }, t), "");
	});

	it("admits when the build has no backend", () => {
		assert.equal(accountRowValue({ kind: "unavailable" }, t), "Unavailable");
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
			signInFailureMessage({ code: "PLAY_SERVICES_NOT_AVAILABLE" }, t),
			/Google Play services/,
		);
	});

	it("never shows the provider's own wording, which is developer-facing", () => {
		// Verbatim from a simulator with no Apple account signed in.
		const raw =
			"RequestUnknownException: The authorization attempt failed for an unknown reason (at ExpoAppleAuthentication/AppleAuthenticationExceptions.swift:61)";
		const shown = signInFailureMessage({ message: raw }, t);
		assert.notEqual(shown, raw);
		assert.doesNotMatch(shown, /Exception|\.swift|at Expo/);
	});

	it("keeps the provider's wording available for a log line", () => {
		assert.equal(
			signInFailureDetail({ message: "Account already linked" }),
			"Account already linked",
		);
		assert.equal(signInFailureDetail({}), null);
	});

	it("never renders an empty or undefined string", () => {
		for (const error of [null, undefined, {}, { message: "  " }, 42]) {
			const message = signInFailureMessage(error, t);
			assert.ok(message.trim().length > 0);
			assert.doesNotMatch(message, /undefined/);
		}
	});
});
