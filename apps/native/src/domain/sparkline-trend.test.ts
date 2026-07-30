import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sparklineSeries } from "./log-sparkline";
import { sparklineLabelKey, sparklineTrendKey } from "./sparkline-trend";

const NOW = new Date("2026-07-30T13:00:00");

/** €200 spent on the 27th and nothing since — a line that visibly falls away. */
const SPIKE = [
	{ date: new Date("2026-07-27T09:00:00"), amount: 200, income: false },
];

function amounts(measure: "in" | "out" | "net") {
	return sparklineSeries(SPIKE, measure, "week", NOW).map(
		(point) => point.amount,
	);
}

describe("sparklineTrendKey", () => {
	it("names a rising series in words rather than leaving it to the stroke colour", () => {
		assert.equal(sparklineTrendKey([10, 20, 45]), "insights.trend.rising");
	});

	it("names a falling series", () => {
		assert.equal(sparklineTrendKey([45, 20, 10]), "insights.trend.falling");
	});

	it("reads a series that closed where it opened as flat, however it wandered", () => {
		assert.equal(sparklineTrendKey([30, 90, 5, 30]), "insights.trend.flat");
	});

	it("reads a series that never moved as flat", () => {
		assert.equal(sparklineTrendKey([0, 0, 0]), "insights.trend.flat");
	});

	it("has no direction to report for an empty series", () => {
		assert.equal(sparklineTrendKey([]), "insights.trend.flat");
	});

	it("has no direction to report for a single sample", () => {
		assert.equal(sparklineTrendKey([12]), "insights.trend.flat");
	});

	it("judges the ends, not the peak: a series that spiked and fell back is falling", () => {
		assert.equal(sparklineTrendKey([50, 400, 20]), "insights.trend.falling");
	});

	it("reads a running balance climbing out of the red as rising", () => {
		assert.equal(sparklineTrendKey([-120, -40, 15]), "insights.trend.rising");
	});

	it("reads a running balance sinking further into the red as falling", () => {
		assert.equal(sparklineTrendKey([-40, -120]), "insights.trend.falling");
	});
});

describe("sparklineLabelKey", () => {
	it("speaks the direction of a running net balance", () => {
		assert.equal(
			sparklineLabelKey("net", amounts("net"), false),
			"insights.trend.falling",
		);
		assert.equal(
			sparklineLabelKey("net", [10, 40], false),
			"insights.trend.rising",
		);
	});

	it("does not read a direction off Out, whose ends are pinned to zero", () => {
		// The window guard empties the opening bucket and the closing sample sits on
		// today's own edge, which the sample before it has already swept — so a
		// first-against-last reading calls this line flat while it visibly falls
		// away from the spike.
		assert.deepEqual([amounts("out")[0], amounts("out").at(-1)], [0, 0]);
		assert.equal(sparklineTrendKey(amounts("out")), "insights.trend.flat");
		assert.equal(
			sparklineLabelKey("out", amounts("out"), false),
			"insights.trend.dailyTotals",
		);
	});

	it("does not read a direction off In either", () => {
		const income = sparklineSeries(
			[{ date: new Date("2026-07-29T09:00:00"), amount: 90, income: true }],
			"in",
			"year",
			NOW,
		).map((point) => point.amount);
		// Monthly sampling does leave the closing bucket filled, so this one would
		// have announced "rising" purely because a month with anything in it
		// followed the zero the series always opens at.
		assert.equal(sparklineTrendKey(income), "insights.trend.rising");
		assert.equal(
			sparklineLabelKey("in", income, true),
			"insights.trend.monthlyTotals",
		);
	});

	it("names the granularity rather than the measure, so daily and monthly differ", () => {
		assert.equal(
			sparklineLabelKey("out", amounts("out"), true),
			"insights.trend.monthlyTotals",
		);
		assert.equal(
			sparklineLabelKey("in", amounts("in"), false),
			"insights.trend.dailyTotals",
		);
	});
});
