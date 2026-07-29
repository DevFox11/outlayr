import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	breakdownRiseIsFavourable,
	INSIGHTS_MEASURE_ORDER,
	insightsMeasureAlternatives,
	insightsMeasureFromStored,
	insightsMeasureIsIncome,
	insightsMeasureIsPositive,
	insightsMeasureMagnitude,
	measureRiseIsFavourable,
	storedInsightsMeasure,
} from "./insights-measure";

const TOTALS = { income: 1200, spent: 500 };
const UNDERWATER = { income: 300, spent: 900 };

describe("stored round-trip", () => {
	it("survives a round-trip for every measure", () => {
		for (const measure of INSIGHTS_MEASURE_ORDER) {
			assert.equal(
				insightsMeasureFromStored(storedInsightsMeasure(measure)),
				measure,
			);
		}
	});

	it("falls back to spent on a value it does not recognise", () => {
		// A spending app's honest default, and what an unseeded install reads.
		assert.equal(insightsMeasureFromStored(0), "spent");
		assert.equal(insightsMeasureFromStored(99), "spent");
	});
});

describe("insightsMeasureMagnitude", () => {
	it("reads each direction unsigned", () => {
		assert.equal(insightsMeasureMagnitude("spent", TOTALS), 500);
		assert.equal(insightsMeasureMagnitude("income", TOTALS), 1200);
		assert.equal(insightsMeasureMagnitude("net", TOTALS), 700);
	});

	it("keeps a net magnitude positive when the window lost money", () => {
		assert.equal(insightsMeasureMagnitude("net", UNDERWATER), 600);
	});
});

describe("insightsMeasureIsPositive", () => {
	it("signs spend negative and income positive regardless of the window", () => {
		assert.equal(insightsMeasureIsPositive("spent", TOTALS), false);
		assert.equal(insightsMeasureIsPositive("income", TOTALS), true);
		assert.equal(insightsMeasureIsPositive("spent", UNDERWATER), false);
	});

	it("signs net from the window itself", () => {
		assert.equal(insightsMeasureIsPositive("net", TOTALS), true);
		assert.equal(insightsMeasureIsPositive("net", UNDERWATER), false);
	});

	it("treats a break-even window as positive rather than negative", () => {
		assert.equal(
			insightsMeasureIsPositive("net", { income: 100, spent: 100 }),
			true,
		);
	});
});

describe("insightsMeasureIsIncome", () => {
	it("gives the income colour only to money actually coming in", () => {
		assert.equal(insightsMeasureIsIncome("income"), true);
		assert.equal(insightsMeasureIsIncome("spent"), false);
		// A positive net is still just a net.
		assert.equal(insightsMeasureIsIncome("net"), false);
	});
});

describe("favourable direction", () => {
	it("treats a rising hero as good except when it is spend", () => {
		assert.equal(measureRiseIsFavourable("spent"), false);
		assert.equal(measureRiseIsFavourable("income"), true);
		assert.equal(measureRiseIsFavourable("net"), true);
	});

	it("treats a rising category as bad except when it is inflow", () => {
		assert.equal(breakdownRiseIsFavourable("income"), true);
		assert.equal(breakdownRiseIsFavourable("spent"), false);
		assert.equal(breakdownRiseIsFavourable("net"), false);
	});

	it("PARTS COMPANY on net, which is the whole reason both exist", () => {
		// Under `net` the hero rising is good news while a category rising is not:
		// `categoryBreakdown` reads outflow for net, so they are not measuring the
		// same money.
		assert.notEqual(
			measureRiseIsFavourable("net"),
			breakdownRiseIsFavourable("net"),
		);
	});

	it("agrees on spent and income, where they do measure the same money", () => {
		assert.equal(
			measureRiseIsFavourable("income"),
			breakdownRiseIsFavourable("income"),
		);
		assert.equal(
			measureRiseIsFavourable("spent"),
			breakdownRiseIsFavourable("spent"),
		);
	});
});

describe("insightsMeasureAlternatives", () => {
	it("returns the two the hero is not showing", () => {
		assert.deepEqual(insightsMeasureAlternatives("spent"), ["income", "net"]);
		assert.deepEqual(insightsMeasureAlternatives("income"), ["spent", "net"]);
		assert.deepEqual(insightsMeasureAlternatives("net"), ["spent", "income"]);
	});

	it("keeps declaration order so the pair never reshuffles under a thumb", () => {
		for (const measure of INSIGHTS_MEASURE_ORDER) {
			const alternatives = insightsMeasureAlternatives(measure);
			const positions = alternatives.map((m) =>
				INSIGHTS_MEASURE_ORDER.indexOf(m),
			);
			assert.deepEqual(
				positions,
				[...positions].sort((a, b) => a - b),
				`${measure} reordered its alternatives`,
			);
		}
	});
});
