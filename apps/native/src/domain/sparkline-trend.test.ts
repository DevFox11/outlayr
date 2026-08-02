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
		expect(sparklineTrendKey([10, 20, 45])).toBe("insights.trend.rising");
	});

	it("names a falling series", () => {
		expect(sparklineTrendKey([45, 20, 10])).toBe("insights.trend.falling");
	});

	it("reads a series that closed where it opened as flat, however it wandered", () => {
		expect(sparklineTrendKey([30, 90, 5, 30])).toBe("insights.trend.flat");
	});

	it("reads a series that never moved as flat", () => {
		expect(sparklineTrendKey([0, 0, 0])).toBe("insights.trend.flat");
	});

	it("has no direction to report for an empty series", () => {
		expect(sparklineTrendKey([])).toBe("insights.trend.flat");
	});

	it("has no direction to report for a single sample", () => {
		expect(sparklineTrendKey([12])).toBe("insights.trend.flat");
	});

	it("judges the ends, not the peak: a series that spiked and fell back is falling", () => {
		expect(sparklineTrendKey([50, 400, 20])).toBe("insights.trend.falling");
	});

	it("reads a running balance climbing out of the red as rising", () => {
		expect(sparklineTrendKey([-120, -40, 15])).toBe("insights.trend.rising");
	});

	it("reads a running balance sinking further into the red as falling", () => {
		expect(sparklineTrendKey([-40, -120])).toBe("insights.trend.falling");
	});
});

describe("sparklineLabelKey", () => {
	it("speaks the direction of a running net balance", () => {
		expect(sparklineLabelKey("net", amounts("net"), false)).toBe(
			"insights.trend.falling",
		);
		expect(sparklineLabelKey("net", [10, 40], false)).toBe(
			"insights.trend.rising",
		);
	});

	it("does not read a direction off Out, whose ends are pinned to zero", () => {
		// The window guard empties the opening bucket and the closing sample sits on
		// today's own edge, which the sample before it has already swept — so a
		// first-against-last reading calls this line flat while it visibly falls
		// away from the spike.
		expect([amounts("out")[0], amounts("out").at(-1)]).toStrictEqual([0, 0]);
		expect(sparklineTrendKey(amounts("out"))).toBe("insights.trend.flat");
		expect(sparklineLabelKey("out", amounts("out"), false)).toBe(
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
		expect(sparklineTrendKey(income)).toBe("insights.trend.rising");
		expect(sparklineLabelKey("in", income, true)).toBe(
			"insights.trend.monthlyTotals",
		);
	});

	it("names the granularity rather than the measure, so daily and monthly differ", () => {
		expect(sparklineLabelKey("out", amounts("out"), true)).toBe(
			"insights.trend.monthlyTotals",
		);
		expect(sparklineLabelKey("in", amounts("in"), false)).toBe(
			"insights.trend.dailyTotals",
		);
	});
});
