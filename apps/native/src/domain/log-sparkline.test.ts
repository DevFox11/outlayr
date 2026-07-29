import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
		assert.deepEqual(sparklineSeries([], "net", "all", NOW), []);
	});

	it("samples a week period at eight points ending today", () => {
		const points = sparklineSeries([], "net", "week", NOW);
		assert.equal(points.length, 8);
		assert.equal(
			points.at(-1)?.date.getTime(),
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
		assert.equal(points[0].amount, 500);
		assert.equal(points.at(-1)?.amount, 300);
	});

	it("never lets the running net fall back once nothing more is logged", () => {
		const points = sparklineSeries(
			[row("2026-07-22T09:00:00", 100)],
			"net",
			"week",
			NOW,
		);
		const tail = points.slice(-3).map((point) => point.amount);
		assert.deepEqual(tail, [-100, -100, -100]);
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
		assert.deepEqual(
			nonZero.map((point) => point.amount),
			[50, 7],
		);
	});

	it("keeps income out of the Out series and expense out of the In series", () => {
		const rows = [
			row("2026-07-23T09:00:00", 40),
			row("2026-07-23T10:00:00", 90, true),
		];
		const out = sparklineSeries(rows, "out", "week", NOW);
		const income = sparklineSeries(rows, "in", "week", NOW);
		assert.equal(
			out.reduce((sum, point) => sum + point.amount, 0),
			40,
		);
		assert.equal(
			income.reduce((sum, point) => sum + point.amount, 0),
			90,
		);
	});

	it("samples a year period monthly", () => {
		const points = sparklineSeries([], "net", "year", NOW);
		assert.equal(points.length, 13);
	});
});

describe("sparklineRange", () => {
	it("counts the days elapsed this month, inclusive of today", () => {
		assert.equal(sparklineRange("month", NOW), 27);
	});

	it("counts the months elapsed this year, inclusive of this one", () => {
		assert.equal(sparklineRange("year", NOW), 7);
	});

	it("counts from the configured first weekday", () => {
		// 2026-07-27 is a Monday.
		assert.equal(sparklineRange("week", NOW, 1), 2);
		assert.equal(sparklineRange("week", NOW, 2), 1);
	});
});

describe("sparklineIsPositive", () => {
	it("greens a net line only when the period ended above where it started", () => {
		const rising = [
			{ date: NOW, amount: 1 },
			{ date: NOW, amount: 5 },
		];
		assert.equal(sparklineIsPositive("net", rising), true);
		assert.equal(sparklineIsPositive("net", [...rising].reverse()), false);
	});

	it("reads money in as always good and money out as never", () => {
		assert.equal(sparklineIsPositive("in", []), true);
		assert.equal(sparklineIsPositive("out", []), false);
	});
});
