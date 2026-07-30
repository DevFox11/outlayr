import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currencyTotals } from "./currency-totals";
import { netTotal } from "./log-measure";
import { scopeTotals } from "./log-scope-figures";
import { buildRateTable } from "./valuation";

const JULY_5 = new Date(Date.UTC(2026, 6, 5, 12));

function entry(amount: number, currency: string | null = null, income = false) {
	return { amount, currency, income };
}

describe("scopeTotals", () => {
	it("gives an empty scope a zero bucket in the currency the screen is read in", () => {
		const { shown, others } = scopeTotals([], "EUR");
		assert.deepEqual(shown, {
			currencyCode: "EUR",
			income: 0,
			expense: 0,
			count: 0,
		});
		assert.deepEqual(others, []);
	});

	it("keeps in and out apart rather than only reporting the net", () => {
		const { shown } = scopeTotals([entry(40), entry(15, null, true)], "USD");
		assert.equal(shown.expense, 40);
		assert.equal(shown.income, 15);
		assert.equal(netTotal(shown), -25);
		assert.equal(shown.count, 2);
	});

	/**
	 * The Log's list is pageable, so the tempting input is whatever it has loaded.
	 * The filtered read is unwindowed precisely so this can be the whole scope.
	 */
	it("totals every entry in the scope, not the page a list would have loaded", () => {
		const scope = Array.from({ length: 60 }, () => entry(10));
		const page = scope.slice(0, 20);

		assert.equal(netTotal(scopeTotals(scope, "USD").shown), -600);
		assert.equal(scopeTotals(scope, "USD").shown.count, 60);
		// The wrong answer this exists to rule out: the same rows, windowed.
		assert.equal(netTotal(scopeTotals(page, "USD").shown), -200);
	});

	it("splits a mixed-currency scope instead of inventing a sum", () => {
		const scope = [entry(40, "USD"), entry(10, "EUR"), entry(10, "EUR")];
		const { shown, others } = scopeTotals(scope, "USD");

		assert.equal(others.length, 1);
		// Pinned against the summer the rest of the app totals with, per bucket.
		const buckets = new Map(
			currencyTotals(scope, "USD").map((bucket) => [
				bucket.currencyCode,
				bucket.amount,
			]),
		);
		assert.equal(buckets.size, 2);
		for (const figures of [shown, ...others]) {
			assert.equal(netTotal(figures), buckets.get(figures.currencyCode));
		}
		// -60 is what adding two currencies together would have produced.
		assert.ok([shown, ...others].every((figures) => netTotal(figures) !== -60));
	});

	it("promotes the currency the screen is read in over the dominant one", () => {
		const { shown } = scopeTotals(
			[entry(40, "USD"), entry(10, "EUR"), entry(10, "EUR")],
			"USD",
		);
		assert.equal(shown.currencyCode, "USD");
		assert.equal(netTotal(shown), -40);
	});

	it("falls back to the dominant bucket when the scope holds no such currency", () => {
		// A zero USD bucket would claim the scope was empty; it is not, it is EUR.
		const { shown, others } = scopeTotals([entry(10, "EUR")], "USD");
		assert.equal(shown.currencyCode, "EUR");
		assert.equal(netTotal(shown), -10);
		assert.deepEqual(others, []);
	});

	it("folds a foreign entry in once a rate reaches it", () => {
		const rates = buildRateTable([
			{ quote: "EUR", date: "2026-07-01", rate: 0.9 },
		]);
		const { shown, others } = scopeTotals(
			[
				{
					amount: 100,
					currency: "USD",
					amountUsd: 100,
					date: JULY_5,
					income: false,
				},
			],
			"EUR",
			rates,
		);
		assert.equal(others.length, 0);
		assert.equal(shown.currencyCode, "EUR");
		assert.equal(shown.expense, 90);
	});
});
