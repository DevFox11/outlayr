import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupByDay } from "./day-sections";
import { buildRateTable } from "./valuation";

function row(day: string, amount: number, income = false) {
	return { day: new Date(`${day}T00:00:00`), amount, income };
}

describe("groupByDay", () => {
	it("returns no sections for no rows", () => {
		assert.deepEqual(groupByDay([]), []);
	});

	it("collects a day's rows under one section in input order", () => {
		const rows = [row("2026-07-24", 12), row("2026-07-24", 30)];
		const sections = groupByDay(rows);
		assert.equal(sections.length, 1);
		assert.equal(sections[0].day.getTime(), rows[0].day.getTime());
		assert.deepEqual(sections[0].data, rows);
	});

	it("subtracts expense and adds income into the day total", () => {
		const sections = groupByDay([
			row("2026-07-24", 40),
			row("2026-07-24", 15, true),
		]);
		assert.equal(sections[0].total, -25);
	});

	it("keeps sections in first-appearance order so a day-desc query stays desc", () => {
		const sections = groupByDay([
			row("2026-07-24", 10),
			row("2026-07-23", 20),
			row("2026-07-21", 30),
		]);
		assert.deepEqual(
			sections.map((section) => section.day.getDate()),
			[24, 23, 21],
		);
	});

	it("merges a day that reappears later without opening a second section", () => {
		// The budget query orders by `date`, not `day`, so an out-of-order row must
		// still land in its own day rather than splitting the section in two.
		const sections = groupByDay([
			row("2026-07-24", 10),
			row("2026-07-23", 20),
			row("2026-07-24", 5),
		]);
		assert.equal(sections.length, 2);
		assert.equal(sections[0].data.length, 2);
		assert.equal(sections[0].total, -15);
		assert.equal(sections[1].total, -20);
	});

	it("buckets a day's total per currency rather than adding two together", () => {
		const [section] = groupByDay(
			[
				{ ...row("2026-07-24", 40) },
				{ ...row("2026-07-24", 10), currency: "EUR" },
			],
			"USD",
		);
		assert.deepEqual(
			section.totals.map((bucket) => [bucket.currencyCode, bucket.amount]),
			[
				["USD", -40],
				["EUR", -10],
			],
		);
	});

	it("copies the day key so callers cannot mutate a row's date through it", () => {
		const rows = [row("2026-07-24", 10)];
		const [section] = groupByDay(rows);
		section.day.setDate(1);
		assert.equal(rows[0].day.getDate(), 24);
	});
});

const eurRates = buildRateTable([
	{ quote: "EUR", date: "2026-07-01", rate: 0.9 },
]);

describe("groupByDay with rates", () => {
	it("reads a mixed-currency day as one figure in the global currency", () => {
		const [section] = groupByDay(
			[
				{ ...row("2026-07-24", 40), currency: "EUR" },
				{
					...row("2026-07-24", 10),
					currency: "USD",
					amountUsd: 10,
					date: new Date(Date.UTC(2026, 6, 24, 12)),
				},
			],
			"EUR",
			eurRates,
		);
		assert.deepEqual(
			section.totals.map((bucket) => [bucket.currencyCode, bucket.amount]),
			[["EUR", -49]],
		);
	});

	it("keeps `total` equal to the sum of the buckets it prints", () => {
		// The header renders `totals`, the section total renders `total`. They are
		// derived figures of the same rows and a user can see both at once.
		const [section] = groupByDay(
			[
				{
					...row("2026-07-24", 0.1),
					currency: "USD",
					amountUsd: 0.1,
					date: new Date(Date.UTC(2026, 6, 24, 12)),
				},
				{
					...row("2026-07-24", 0.1),
					currency: "USD",
					amountUsd: 0.1,
					date: new Date(Date.UTC(2026, 6, 24, 12)),
				},
				{
					...row("2026-07-24", 0.1),
					currency: "USD",
					amountUsd: 0.1,
					date: new Date(Date.UTC(2026, 6, 24, 12)),
				},
			],
			"EUR",
			eurRates,
		);
		let summed = 0;
		for (const bucket of section.totals) {
			summed += bucket.amount;
		}
		assert.equal(section.total, summed);
		assert.equal(section.total, -0.27);
	});
});
