import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flyleafDate } from "./flyleaf";

describe("flyleafDate", () => {
	it("writes the English form", () => {
		assert.equal(flyleafDate(new Date(2026, 6, 30), "en"), "July 30, 2026");
	});

	it("writes the Spanish form", () => {
		assert.equal(
			flyleafDate(new Date(2026, 6, 30), "es"),
			"30 de julio de 2026",
		);
	});

	it("covers the year boundary months", () => {
		assert.equal(flyleafDate(new Date(2027, 0, 1), "en"), "January 1, 2027");
		assert.equal(
			flyleafDate(new Date(2026, 11, 31), "es"),
			"31 de diciembre de 2026",
		);
	});
});
