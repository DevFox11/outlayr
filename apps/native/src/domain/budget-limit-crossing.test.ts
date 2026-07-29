import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossingDay } from "./budget-limit-crossing";

/** Cumulative spend for a month whose only charges land on days 1, 3 and 6. */
const SERIES = [15, 15, 115, 115, 115, 2715, 2715];

describe("crossingDay", () => {
	it("returns the first day the cumulative spend passes the limit", () => {
		assert.equal(crossingDay(SERIES, 200), 6);
	});

	it("counts a limit equal to a day's cumulative as spent on that day", () => {
		assert.equal(crossingDay(SERIES, 115), 3);
	});

	it("returns null for a limit above the month's total", () => {
		assert.equal(crossingDay(SERIES, 2715.01), null);
	});

	it("returns day one for a limit below the first transaction", () => {
		assert.equal(crossingDay(SERIES, 10), 1);
	});

	it("returns null for an empty series", () => {
		assert.equal(crossingDay([], 500), null);
	});

	it("holds at exactly the total rather than clearing it", () => {
		assert.equal(crossingDay(SERIES, 2715), 6);
	});
});
