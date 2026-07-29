import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supportBody, supportMailto } from "./support-mailto";

const INFO = {
	appName: "Outlayr",
	osName: "iOS",
	osVersion: "26.0",
	deviceName: "iPhone",
	appVersion: "1.2.0",
	appBuild: "42",
};

describe("support email body", () => {
	it("carries every diagnostic Swift prefilled", () => {
		const body = supportBody(INFO);
		assert.match(body, /Application Name: Outlayr/);
		assert.match(body, /Platform: iOS 26\.0/);
		assert.match(body, /Device: iPhone/);
		assert.match(body, /App Version: 1\.2\.0/);
		assert.match(body, /App Build: 42/);
	});

	it("ends with a rule the user writes below", () => {
		const lines = supportBody(INFO).split("\n");
		assert.equal(lines.at(-1), "--------------------------------------");
	});

	it("keeps an unknown field readable rather than printing undefined", () => {
		const body = supportBody({ ...INFO, deviceName: "" });
		assert.match(body, /Device: Unknown/);
		assert.doesNotMatch(body, /undefined/);
	});
});

describe("support mailto", () => {
	it("addresses the mail and encodes the subject", () => {
		const url = supportMailto("help@example.com", "Feature Request", INFO);
		assert.match(url, /^mailto:help@example\.com\?/);
		assert.match(url, /subject=Feature%20Request/);
	});

	it("percent-encodes the body so newlines never truncate the link", () => {
		const url = supportMailto("help@example.com", "Support Email", INFO);
		const body = url.split("&body=")[1];
		assert.ok(body);
		assert.doesNotMatch(body, /\n/);
		assert.equal(decodeURIComponent(body), supportBody(INFO));
	});

	it("escapes an ampersand in the body instead of starting a new parameter", () => {
		const url = supportMailto("help@example.com", "Support Email", {
			...INFO,
			appName: "Out&layr",
		});
		assert.equal(url.split("&body=").length, 2);
		assert.match(url, /Out%26layr/);
	});

	it("escapes an ampersand in the subject", () => {
		const url = supportMailto("help@example.com", "Bugs & Ideas", INFO);
		assert.match(url, /subject=Bugs%20%26%20Ideas/);
		assert.equal(url.split("&body=").length, 2);
	});
});
