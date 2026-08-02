import {
	sparklineIsPositive,
	sparklineRange,
	sparklineSeries,
} from "./log-sparkline";

const NOW = new Date("2026-07-27T13:00:00");

function row(iso: string, amount: number, income = false) {
	return { date: new Date(iso), amount, income };
}

describe("sparklineSeries", () => {
	it("has no series for all-time, which has no window to sample", () => {
		expect(sparklineSeries([], "net", "all", NOW)).toStrictEqual([]);
	});

	it("samples a week period at eight points ending today", () => {
		const points = sparklineSeries([], "net", "week", NOW);
		expect(points.length).toBe(8);
		expect(points.at(-1)?.date.getTime()).toBe(
			new Date("2026-07-27T00:00:00").getTime(),
		);
	});

	it("walks net forward as a running balance, including entries before the window", () => {
		const points = sparklineSeries(
			[
				// Predates the window entirely — it still sets the opening balance.
				row("2026-01-04T09:00:00", 500, true),
				row("2026-07-24T09:00:00", 200),
			],
			"net",
			"week",
			NOW,
		);
		expect(points[0].amount).toBe(500);
		expect(points.at(-1)?.amount).toBe(300);
	});

	it("never lets the running net fall back once nothing more is logged", () => {
		const points = sparklineSeries(
			[row("2026-07-22T09:00:00", 100)],
			"net",
			"week",
			NOW,
		);
		const tail = points.slice(-3).map((point) => point.amount);
		expect(tail).toStrictEqual([-100, -100, -100]);
	});

	it("buckets Out per sample instead of accumulating it", () => {
		const points = sparklineSeries(
			[
				row("2026-07-23T09:00:00", 40),
				row("2026-07-23T18:00:00", 10),
				row("2026-07-25T09:00:00", 7),
			],
			"out",
			"week",
			NOW,
		);
		const nonZero = points.filter((point) => point.amount !== 0);
		expect(nonZero.map((point) => point.amount)).toStrictEqual([50, 7]);
	});

	it("keeps income out of the Out series and expense out of the In series", () => {
		const rows = [
			row("2026-07-23T09:00:00", 40),
			row("2026-07-23T10:00:00", 90, true),
		];
		const out = sparklineSeries(rows, "out", "week", NOW);
		const income = sparklineSeries(rows, "in", "week", NOW);
		expect(out.reduce((sum, point) => sum + point.amount, 0)).toBe(40);
		expect(income.reduce((sum, point) => sum + point.amount, 0)).toBe(90);
	});

	it("samples a year period monthly", () => {
		const points = sparklineSeries([], "net", "year", NOW);
		expect(points.length).toBe(13);
	});
});

describe("sparklineRange", () => {
	it("counts the days elapsed this month, inclusive of today", () => {
		expect(sparklineRange("month", NOW)).toBe(27);
	});

	it("counts the months elapsed this year, inclusive of this one", () => {
		expect(sparklineRange("year", NOW)).toBe(7);
	});

	it("counts from the configured first weekday", () => {
		// 2026-07-27 is a Monday.
		expect(sparklineRange("week", NOW, 1)).toBe(2);
		expect(sparklineRange("week", NOW, 2)).toBe(1);
	});
});

describe("sparklineIsPositive", () => {
	it("greens a net line only when the period ended above where it started", () => {
		const rising = [
			{ date: NOW, amount: 1 },
			{ date: NOW, amount: 5 },
		];
		expect(sparklineIsPositive("net", rising)).toBe(true);
		expect(sparklineIsPositive("net", [...rising].reverse())).toBe(false);
	});

	it("reads money in as always good and money out as never", () => {
		expect(sparklineIsPositive("in", [])).toBe(true);
		expect(sparklineIsPositive("out", [])).toBe(false);
	});
});
