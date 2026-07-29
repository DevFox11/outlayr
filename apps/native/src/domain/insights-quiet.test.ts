import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quietAlternative } from "./insights-quiet";

describe("quietAlternative", () => {
	it("returns null on a window with no money at all, since there is nowhere to send anyone", () => {
		assert.equal(quietAlternative("spent", { income: 0, spent: 0 }), null);
		assert.equal(quietAlternative("income", { income: 0, spent: 0 }), null);
		assert.equal(quietAlternative("net", { income: 0, spent: 0 }), null);
	});

	it("sends a quiet spend window to the income that window did hold", () => {
		assert.equal(
			quietAlternative("spent", { income: 1200, spent: 0 }),
			"income",
		);
	});

	it("sends a quiet income window to spent rather than net, because a direction beats a derived figure", () => {
		assert.equal(
			quietAlternative("income", { income: 0, spent: 900 }),
			"spent",
		);
	});

	it("sends a quiet net window to whichever direction actually moved", () => {
		assert.equal(quietAlternative("net", { income: 0, spent: 900 }), "spent");
		assert.equal(quietAlternative("net", { income: 1200, spent: 0 }), "income");
	});

	it("prefers spent over income on a window that cancelled out, so the choice never reshuffles", () => {
		assert.equal(quietAlternative("net", { income: 500, spent: 500 }), "spent");
	});

	it("returns null for a one-sided window whose only figure is the promoted one", () => {
		assert.equal(quietAlternative("income", { income: 1200, spent: 0 }), null);
		assert.equal(quietAlternative("spent", { income: 0, spent: 900 }), null);
	});

	it("never offers net, because a quiet promoted measure leaves net restating the other direction", () => {
		const WINDOWS = [
			{ income: 0, spent: 0 },
			{ income: 1200, spent: 0 },
			{ income: 0, spent: 900 },
			{ income: 1200, spent: 900 },
			{ income: 500, spent: 500 },
		];
		for (const totals of WINDOWS) {
			for (const measure of ["spent", "income", "net"] as const) {
				assert.notEqual(
					quietAlternative(measure, totals),
					"net",
					`${measure} on ${JSON.stringify(totals)} offered net`,
				);
			}
		}
	});
});
