import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cellFigures,
	cellTotals,
	currencyTotals,
	toCells,
} from "./currency-totals";
import { buildRateTable } from "./valuation";

function entry(amount: number, income = false, currency: string | null = null) {
	return { amount, income, currency };
}

describe("currencyTotals", () => {
	it("gives an empty set one zero bucket, so a caller always has something to draw", () => {
		assert.deepEqual(currencyTotals([], "USD"), [
			{ currencyCode: "USD", amount: 0, transactionCount: 0 },
		]);
	});

	it("files a row with no currency of its own under the global one", () => {
		const [bucket] = currencyTotals([entry(10)], "USD");
		assert.equal(bucket.currencyCode, "USD");
		assert.equal(bucket.amount, -10);
	});

	it("signs income up and expense down inside each bucket", () => {
		const [bucket] = currencyTotals([entry(40), entry(15, true)], "USD");
		assert.equal(bucket.amount, -25);
	});

	it("never adds two currencies together", () => {
		const buckets = currencyTotals([entry(40), entry(10, false, "EUR")], "USD");
		assert.equal(buckets.length, 2);
		assert.deepEqual(
			buckets.map((b) => b.amount),
			[-40, -10],
		);
	});

	it("ranks by transaction count first", () => {
		const buckets = currencyTotals(
			[entry(1, false, "EUR"), entry(1, false, "EUR"), entry(999)],
			"USD",
		);
		assert.equal(buckets[0].currencyCode, "EUR");
	});

	it("breaks a count tie in the user's own currency's favour", () => {
		const buckets = currencyTotals(
			[entry(1, false, "EUR"), entry(1, false, "USD")],
			"USD",
		);
		assert.equal(buckets[0].currencyCode, "USD");
	});

	it("breaks a remaining tie alphabetically rather than arbitrarily", () => {
		const buckets = currencyTotals(
			[entry(1, false, "JPY"), entry(1, false, "EUR")],
			"USD",
		);
		assert.deepEqual(
			buckets.map((b) => b.currencyCode),
			["EUR", "JPY"],
		);
	});
});

const JULY_5 = new Date(Date.UTC(2026, 6, 5, 12));
const JULY_20 = new Date(Date.UTC(2026, 6, 20, 12));

/** USD→EUR at 0.90 from 1 July, 0.95 from 10 July. */
const eurRates = buildRateTable([
	{ quote: "EUR", date: "2026-07-01", rate: 0.9 },
	{ quote: "EUR", date: "2026-07-10", rate: 0.95 },
]);

function priced(
	amount: number,
	currency: string,
	amountUsd: number | null,
	date: Date,
	income = false,
) {
	return { amount, currency, amountUsd, date, income };
}

describe("currencyTotals with rates", () => {
	it("folds a foreign entry into the global currency at its own day's rate", () => {
		const buckets = currencyTotals(
			[priced(100, "USD", 100, JULY_5)],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "EUR", amount: -90, transactionCount: 1 },
		]);
	});

	it("values two days at their own rates rather than one blended rate", () => {
		// $100 on the 5th is €90, $100 on the 20th is €95. A single conversion of
		// the $200 would print €180 or €190 — both wrong.
		const buckets = currencyTotals(
			[priced(100, "USD", 100, JULY_5), priced(100, "USD", 100, JULY_20)],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "EUR", amount: -185, transactionCount: 2 },
		]);
	});

	it("collapses a mixed-currency day to one figure", () => {
		const buckets = currencyTotals(
			[
				priced(50, "EUR", 55.56, JULY_5),
				priced(100, "USD", 100, JULY_5),
				priced(1000, "JPY", 6.4, JULY_5),
			],
			"EUR",
			eurRates,
		);
		assert.equal(buckets.length, 1);
		assert.equal(buckets[0].currencyCode, "EUR");
		// 50 + 90 + 5.76
		assert.equal(buckets[0].amount, -145.76);
	});

	it("leaves an entry with no frozen USD value in its own currency", () => {
		const buckets = currencyTotals(
			[priced(100, "USD", null, JULY_5)],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "USD", amount: -100, transactionCount: 1 },
		]);
	});

	it("splits a day where only some entries were canonicalized", () => {
		// The convertible half must not drag the other half in with it, and the
		// other half must not keep the convertible half out.
		const buckets = currencyTotals(
			[priced(100, "USD", 100, JULY_5), priced(40, "USD", null, JULY_5)],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "EUR", amount: -90, transactionCount: 1 },
			{ currencyCode: "USD", amount: -40, transactionCount: 1 },
		]);
	});

	it("keeps an entry older than any rate in its own currency", () => {
		const buckets = currencyTotals(
			[priced(100, "USD", 100, new Date(Date.UTC(2020, 0, 1)))],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "USD", amount: -100, transactionCount: 1 },
		]);
	});

	it("uses the frozen USD value directly when the ledger reads in USD", () => {
		// No rate table can cover USD→USD, and none is needed.
		const buckets = currencyTotals(
			[priced(92, "EUR", 100, JULY_5)],
			"USD",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "USD", amount: -100, transactionCount: 1 },
		]);
	});

	it("converts the day's sum once, not each entry", () => {
		// Three $0.10 charges are $0.30 → €0.27 at 0.90. Rounding each conversion
		// first gives 0.09 × 3 = €0.27 here, but the header aggregates in SQL where
		// only the sum survives — both paths must round the same figure.
		const cells = toCells([
			priced(0.1, "USD", 0.1, JULY_5),
			priced(0.1, "USD", 0.1, JULY_5),
			priced(0.1, "USD", 0.1, JULY_5),
		]);
		assert.equal(cells.length, 1);
		assert.equal(cells[0].amountUsd, 0.30000000000000004);
		assert.deepEqual(cellTotals(cells, "EUR", eurRates), [
			{ currencyCode: "EUR", amount: -0.27, transactionCount: 3 },
		]);
	});

	it("ignores rates when the entry carries no date", () => {
		const buckets = currencyTotals(
			[{ amount: 100, currency: "USD", income: false, amountUsd: 100 }],
			"EUR",
			eurRates,
		);
		assert.deepEqual(buckets, [
			{ currencyCode: "USD", amount: -100, transactionCount: 1 },
		]);
	});
});

describe("figures over a whole result set", () => {
	// What the Search header prints: one in/out/net block per currency over every
	// matched row, whatever day each landed on.
	it("keeps in and out apart across every day in the set", () => {
		const figures = cellFigures(
			toCells([
				priced(30, "USD", 30, JULY_5),
				priced(70, "USD", 70, JULY_20),
				priced(200, "USD", 200, JULY_20, true),
			]),
			"USD",
		);
		assert.deepEqual(figures, [
			{ currencyCode: "USD", income: 200, expense: 100, count: 3 },
		]);
	});

	it("splits a mixed-currency result rather than inventing one sum", () => {
		// No frozen USD value on the euro rows, so no rate reaches them and the
		// result keeps two blocks. Counts put the dominant currency first.
		const figures = cellFigures(
			toCells([
				priced(100, "USD", 100, JULY_5),
				priced(50, "EUR", null, JULY_5),
				priced(20, "EUR", null, JULY_5, true),
			]),
			"USD",
			eurRates,
		);
		assert.deepEqual(figures, [
			{ currencyCode: "EUR", income: 20, expense: 50, count: 2 },
			{ currencyCode: "USD", income: 0, expense: 100, count: 1 },
		]);
	});

	it("nets each currency on its own, so neither block borrows the other's sign", () => {
		const figures = cellFigures(
			toCells([
				priced(10, "USD", 10, JULY_5, true),
				priced(40, "EUR", null, JULY_5),
			]),
			"USD",
			eurRates,
		);
		assert.deepEqual(
			figures.map((entry) => ({
				code: entry.currencyCode,
				net: entry.income - entry.expense,
			})),
			[
				{ code: "USD", net: 10 },
				{ code: "EUR", net: -40 },
			],
		);
	});
});

describe("switching display currency", () => {
	// A ledger written entirely under one setting stores `currency: null` on every
	// row. Reading null as "already in the display currency" relabels the whole
	// history instead of converting it — $99.15 of lunches becoming €99.15.
	const nullCurrency = [
		{
			amount: 18.5,
			income: false,
			currency: null,
			amountUsd: 18.5,
			date: JULY_5,
		},
		{
			amount: 12.4,
			income: false,
			currency: null,
			amountUsd: 12.4,
			date: JULY_5,
		},
		{
			amount: 68.25,
			income: false,
			currency: null,
			amountUsd: 68.25,
			date: JULY_5,
		},
	];

	it("leaves the figures alone while the setting still matches", () => {
		assert.deepEqual(currencyTotals(nullCurrency, "USD", eurRates), [
			{ currencyCode: "USD", amount: -99.15, transactionCount: 3 },
		]);
	});

	it("converts the whole history when the setting changes", () => {
		// 99.15 USD at the 5 July rate of 0.90, converted once.
		assert.deepEqual(currencyTotals(nullCurrency, "EUR", eurRates), [
			{ currencyCode: "EUR", amount: -89.24, transactionCount: 3 },
		]);
	});

	it("falls back to the ledger's currency for a row nothing can place", () => {
		const orphan = [
			{
				amount: 40,
				income: false,
				currency: null,
				amountUsd: null,
				date: JULY_5,
			},
		];
		assert.deepEqual(currencyTotals(orphan, "EUR", eurRates), [
			{ currencyCode: "EUR", amount: -40, transactionCount: 1 },
		]);
	});
});
