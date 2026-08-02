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
		expect(shown).toStrictEqual({
			currencyCode: "EUR",
			income: 0,
			expense: 0,
			count: 0,
		});
		expect(others).toStrictEqual([]);
	});

	it("keeps in and out apart rather than only reporting the net", () => {
		const { shown } = scopeTotals([entry(40), entry(15, null, true)], "USD");
		expect(shown.expense).toBe(40);
		expect(shown.income).toBe(15);
		expect(netTotal(shown)).toBe(-25);
		expect(shown.count).toBe(2);
	});

	/**
	 * The Log's list is pageable, so the tempting input is whatever it has loaded.
	 * The filtered read is unwindowed precisely so this can be the whole scope.
	 */
	it("totals every entry in the scope, not the page a list would have loaded", () => {
		const scope = Array.from({ length: 60 }, () => entry(10));
		const page = scope.slice(0, 20);

		expect(netTotal(scopeTotals(scope, "USD").shown)).toBe(-600);
		expect(scopeTotals(scope, "USD").shown.count).toBe(60);
		// The wrong answer this exists to rule out: the same rows, windowed.
		expect(netTotal(scopeTotals(page, "USD").shown)).toBe(-200);
	});

	it("splits a mixed-currency scope instead of inventing a sum", () => {
		const scope = [entry(40, "USD"), entry(10, "EUR"), entry(10, "EUR")];
		const { shown, others } = scopeTotals(scope, "USD");

		expect(others.length).toBe(1);
		// Pinned against the summer the rest of the app totals with, per bucket.
		const buckets = new Map(
			currencyTotals(scope, "USD").map((bucket) => [
				bucket.currencyCode,
				bucket.amount,
			]),
		);
		expect(buckets.size).toBe(2);
		for (const figures of [shown, ...others]) {
			expect(netTotal(figures)).toBe(buckets.get(figures.currencyCode));
		}
		// -60 is what adding two currencies together would have produced.
		expect(
			[shown, ...others].every((figures) => netTotal(figures) !== -60),
		).toBeTruthy();
	});

	it("promotes the currency the screen is read in over the dominant one", () => {
		const { shown } = scopeTotals(
			[entry(40, "USD"), entry(10, "EUR"), entry(10, "EUR")],
			"USD",
		);
		expect(shown.currencyCode).toBe("USD");
		expect(netTotal(shown)).toBe(-40);
	});

	it("falls back to the dominant bucket when the scope holds no such currency", () => {
		// A zero USD bucket would claim the scope was empty; it is not, it is EUR.
		const { shown, others } = scopeTotals([entry(10, "EUR")], "USD");
		expect(shown.currencyCode).toBe("EUR");
		expect(netTotal(shown)).toBe(-10);
		expect(others).toStrictEqual([]);
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
		expect(others.length).toBe(0);
		expect(shown.currencyCode).toBe("EUR");
		expect(shown.expense).toBe(90);
	});
});
