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
			expect(insightsMeasureFromStored(storedInsightsMeasure(measure))).toBe(measure);
		}
	});

	it("falls back to spent on a value it does not recognise", () => {
		// A spending app's honest default, and what an unseeded install reads.
		expect(insightsMeasureFromStored(0)).toBe("spent");
		expect(insightsMeasureFromStored(99)).toBe("spent");
	});
});

describe("insightsMeasureMagnitude", () => {
	it("reads each direction unsigned", () => {
		expect(insightsMeasureMagnitude("spent", TOTALS)).toBe(500);
		expect(insightsMeasureMagnitude("income", TOTALS)).toBe(1200);
		expect(insightsMeasureMagnitude("net", TOTALS)).toBe(700);
	});

	it("keeps a net magnitude positive when the window lost money", () => {
		expect(insightsMeasureMagnitude("net", UNDERWATER)).toBe(600);
	});
});

describe("insightsMeasureIsPositive", () => {
	it("signs spend negative and income positive regardless of the window", () => {
		expect(insightsMeasureIsPositive("spent", TOTALS)).toBe(false);
		expect(insightsMeasureIsPositive("income", TOTALS)).toBe(true);
		expect(insightsMeasureIsPositive("spent", UNDERWATER)).toBe(false);
	});

	it("signs net from the window itself", () => {
		expect(insightsMeasureIsPositive("net", TOTALS)).toBe(true);
		expect(insightsMeasureIsPositive("net", UNDERWATER)).toBe(false);
	});

	it("treats a break-even window as positive rather than negative", () => {
		expect(insightsMeasureIsPositive("net", { income: 100, spent: 100 })).toBe(true);
	});
});

describe("insightsMeasureIsIncome", () => {
	it("gives the income colour only to money actually coming in", () => {
		expect(insightsMeasureIsIncome("income")).toBe(true);
		expect(insightsMeasureIsIncome("spent")).toBe(false);
		// A positive net is still just a net.
		expect(insightsMeasureIsIncome("net")).toBe(false);
	});
});

describe("favourable direction", () => {
	it("treats a rising hero as good except when it is spend", () => {
		expect(measureRiseIsFavourable("spent")).toBe(false);
		expect(measureRiseIsFavourable("income")).toBe(true);
		expect(measureRiseIsFavourable("net")).toBe(true);
	});

	it("treats a rising category as bad except when it is inflow", () => {
		expect(breakdownRiseIsFavourable("income")).toBe(true);
		expect(breakdownRiseIsFavourable("spent")).toBe(false);
		expect(breakdownRiseIsFavourable("net")).toBe(false);
	});

	it("PARTS COMPANY on net, which is the whole reason both exist", () => {
		// Under `net` the hero rising is good news while a category rising is not:
		// `categoryBreakdown` reads outflow for net, so they are not measuring the
		// same money.
		expect(measureRiseIsFavourable("net")).not.toBe(breakdownRiseIsFavourable("net"));
	});

	it("agrees on spent and income, where they do measure the same money", () => {
		expect(measureRiseIsFavourable("income")).toBe(breakdownRiseIsFavourable("income"));
		expect(measureRiseIsFavourable("spent")).toBe(breakdownRiseIsFavourable("spent"));
	});
});

describe("insightsMeasureAlternatives", () => {
	it("returns the two the hero is not showing", () => {
		expect(insightsMeasureAlternatives("spent")).toStrictEqual(["income", "net"]);
		expect(insightsMeasureAlternatives("income")).toStrictEqual(["spent", "net"]);
		expect(insightsMeasureAlternatives("net")).toStrictEqual(["spent", "income"]);
	});

	it("keeps declaration order so the pair never reshuffles under a thumb", () => {
		for (const measure of INSIGHTS_MEASURE_ORDER) {
			const alternatives = insightsMeasureAlternatives(measure);
			const positions = alternatives.map((m) => INSIGHTS_MEASURE_ORDER.indexOf(m));
			expect(positions).toStrictEqual([...positions].sort((a, b) => a - b));
		}
	});
});
