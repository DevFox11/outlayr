import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverageNote } from "./valuation-coverage";

describe("coverageNote", () => {
	it("says nothing when every figure rests on a converted row", () => {
		assert.equal(
			coverageNote({ converted: 120, pending: 0, beyondRateHistory: 0 }),
			null,
		);
		assert.equal(
			coverageNote({ converted: 0, pending: 0, beyondRateHistory: 0 }),
			null,
		);
	});

	it("says a backlog is draining when the rows are still reachable", () => {
		assert.equal(
			coverageNote({ converted: 117, pending: 3, beyondRateHistory: 0 }),
			"Rates are still catching up: 3 of 120 entries are counted at the amount they were logged in.",
		);
	});

	it("does not promise a permanent tail will ever resolve", () => {
		assert.equal(
			coverageNote({ converted: 118, pending: 0, beyondRateHistory: 2 }),
			"2 of 120 entries predate the rate history, so they are counted at the amount they were logged in.",
		);
	});

	it("keeps the two apart when the ledger has both", () => {
		assert.equal(
			coverageNote({ converted: 115, pending: 3, beyondRateHistory: 2 }),
			"Rates are still catching up: 3 of 120 entries are counted at the amount they were logged in. 2 more predate the rate history and always will be.",
		);
	});
});
