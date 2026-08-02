import { roundMoney } from "@outlayr/money";
import { currencyTotals } from "./currency-totals";
import {
	buildRateTable,
	isExact,
	limitIn,
	sumValuedIn,
	valueIn,
	valueRowsIn,
} from "./valuation";

const rates = buildRateTable([
	{ quote: "EUR", date: "2026-07-01", rate: 0.9 },
	{ quote: "EUR", date: "2026-07-10", rate: 0.95 },
	{ quote: "VES", date: "2026-07-10", rate: 40 },
]);

describe("buildRateTable", () => {
	it("answers with the newest rate on or before the date", () => {
		expect(rates.get("EUR", "2026-07-15")).toBe(0.95);
		expect(rates.get("EUR", "2026-07-10")).toBe(0.95);
		expect(rates.get("EUR", "2026-07-05")).toBe(0.9);
	});

	it("declines before its earliest row, and for an unknown code", () => {
		expect(rates.get("EUR", "2026-06-30")).toBe(null);
		expect(rates.get("JPY", "2026-07-15")).toBe(null);
	});
});

describe("valueIn", () => {
	it("returns the stored amount untouched when already in display currency", () => {
		// The common path. A round-trip through USD here would drift a cent on a
		// ledger kept entirely in one currency.
		const value = valueIn(
			{
				amount: 12.4,
				currency: "EUR",
				amountUsd: 13.78,
				dateKey: "2026-07-15",
			},
			"EUR",
			rates,
		);
		expect(value).toBe(12.4);
	});

	it("converts a null-currency row instead of relabelling it", () => {
		// The row named no currency, so it was written under whatever the ledger's
		// currency was that day. Handing back 99 here would restate a $110 lunch as
		// €99 the moment the user switched their display currency.
		const value = valueIn(
			{ amount: 99, currency: null, amountUsd: 110, dateKey: "2026-07-15" },
			"EUR",
			rates,
		);
		expect(value).toBe(104.5);
	});

	it("still takes a null-currency row at face value when it has no USD value", () => {
		// Nothing can place it, so the ledger's currency is the only label left.
		const value = valueIn(
			{ amount: 99, currency: null, amountUsd: null, dateKey: "2026-07-15" },
			"EUR",
			rates,
		);
		expect(value).toBe(99);
	});

	it("converts a cross-currency row at the rate of ITS OWN day", () => {
		// $100 on 5 Jul values at that day's 0.90, not the later 0.95 — otherwise
		// last month's total would move every time rates do.
		const value = valueIn(
			{ amount: 100, currency: "USD", amountUsd: 100, dateKey: "2026-07-05" },
			"EUR",
			rates,
		);
		expect(value).toBe(90);
	});

	it("converts a USD row that was never canonicalized", () => {
		// $100 is $100: a USD row needs nothing frozen.
		const value = valueIn(
			{ amount: 100, currency: "USD", amountUsd: null, dateKey: "2026-07-05" },
			"EUR",
			rates,
		);
		expect(value).toBe(90);
	});

	it("uses the canonical value directly when display is USD", () => {
		const value = valueIn(
			{ amount: 90, currency: "EUR", amountUsd: 100, dateKey: "2026-07-05" },
			"USD",
			rates,
		);
		expect(value).toBe(100);
	});

	it("rounds to the display currency's own exponent", () => {
		// JPY has no minor units; 0.95-style fractions must not survive into it.
		const jpy = buildRateTable([
			{ quote: "JPY", date: "2026-07-01", rate: 157.3 },
		]);
		const value = valueIn(
			{ amount: 1, currency: "USD", amountUsd: 1, dateKey: "2026-07-05" },
			"JPY",
			jpy,
		);
		expect(value).toBe(157);
	});

	it("falls back to face value rather than dropping money", () => {
		// Entered offline, never canonicalized: it still belongs in the total.
		const noUsd = valueIn(
			{ amount: 50, currency: "GBP", amountUsd: null, dateKey: "2026-07-15" },
			"EUR",
			rates,
		);
		expect(noUsd).toBe(50);

		// Canonical, but no rate for the display currency that far back.
		const noRate = valueIn(
			{ amount: 50, currency: "USD", amountUsd: 50, dateKey: "2020-01-01" },
			"EUR",
			rates,
		);
		expect(noRate).toBe(50);
	});
});

describe("isExact", () => {
	it("is true for a same-currency row and for a canonicalized one", () => {
		expect(
			isExact(
				{ amount: 1, currency: "EUR", amountUsd: null, dateKey: "2026-07-15" },
				"EUR",
				rates,
			),
		).toBe(true);
		expect(
			isExact(
				{ amount: 1, currency: "USD", amountUsd: 1, dateKey: "2026-07-15" },
				"EUR",
				rates,
			),
		).toBe(true);
	});

	it("is false for a cross-currency row that was never canonicalized", () => {
		// GBP, not USD: a USD row needs nothing frozen, since its canonical value
		// is the amount itself.
		expect(
			isExact(
				{ amount: 1, currency: "GBP", amountUsd: null, dateKey: "2026-07-15" },
				"EUR",
				rates,
			),
		).toBe(false);
	});

	it("is true for a USD row with no frozen value", () => {
		expect(
			isExact(
				{ amount: 1, currency: "USD", amountUsd: null, dateKey: "2026-07-15" },
				"EUR",
				rates,
			),
		).toBe(true);
	});

	it("is false when canonical but no rate reaches that far back", () => {
		// A frozen USD value is not proof the row can be converted: with no rate in
		// the table `valueIn` falls back to face value.
		expect(
			isExact(
				{ amount: 1, currency: "USD", amountUsd: 1, dateKey: "2020-01-01" },
				"EUR",
				rates,
			),
		).toBe(false);
	});
});

describe("limitIn", () => {
	it("restates a target at the rate of the day its window opened", () => {
		// Both legs on the window's day, not the amount's USD value frozen on the
		// day the target was set: 4000 VES / 40 = $100, and $100 * 0.95 = €95. The
		// stored 200 is a stale freeze and must not reach the screen.
		expect(
			limitIn(
				{ amount: 4000, currency: "VES", amountUsd: 200 },
				new Date(Date.UTC(2026, 6, 15)),
				"EUR",
				rates,
			),
		).toBe(95);
	});

	it("falls back to the frozen value when no rate reaches the window", () => {
		// VES has no rate on or before 2026-07-01, so the stored USD value is the
		// only thing left that can place the target.
		expect(
			limitIn(
				{ amount: 4000, currency: "VES", amountUsd: 200 },
				new Date(Date.UTC(2026, 6, 1)),
				"EUR",
				rates,
			),
		).toBe(180);
	});

	it("hands back a target already in the display currency untouched", () => {
		expect(
			limitIn(
				{ amount: 250.5, currency: "EUR", amountUsd: 278.33 },
				new Date(Date.UTC(2026, 6, 15)),
				"EUR",
				rates,
			),
		).toBe(250.5);
	});
});

describe("sumValuedIn", () => {
	const JULY_15 = new Date(Date.UTC(2026, 6, 15, 12));

	it("adds a mixed-currency list in the display currency", () => {
		// 40 EUR is already there; 50 USD is worth 47.50 at that day's rate.
		expect(
			sumValuedIn(
				[
					{ amount: 40, currency: "EUR", amountUsd: 44.44, date: JULY_15 },
					{ amount: 50, currency: "USD", amountUsd: null, date: JULY_15 },
				],
				"EUR",
				rates,
			),
		).toBe(87.5);
	});

	it("values each row at its own day", () => {
		expect(
			sumValuedIn(
				[
					{
						amount: 100,
						currency: "USD",
						amountUsd: null,
						date: new Date(Date.UTC(2026, 6, 5, 12)),
					},
					{ amount: 100, currency: "USD", amountUsd: null, date: JULY_15 },
				],
				"EUR",
				rates,
			),
		).toBe(185);
	});
});

describe("valueRowsIn", () => {
	const JULY_5 = new Date(Date.UTC(2026, 6, 5, 12));
	const JULY_15 = new Date(Date.UTC(2026, 6, 15, 12));
	const cents = (value: number) => roundMoney(value);
	const added = (values: readonly number[]) =>
		cents(values.reduce((total, value) => total + value, 0));

	// $2.15 is €1.935 at 0.9 and €2.0425 at 0.95: rounded on its own each row is a
	// fifth of a cent out, and four of them per day carry that into the open.
	const entries = [JULY_5, JULY_15].flatMap((date) =>
		Array.from({ length: 4 }, () => ({
			amount: 2.15,
			currency: "USD",
			amountUsd: 2.15,
			income: true,
			date,
		})),
	);
	const asValuable = (entry: (typeof entries)[number]) => ({
		amount: entry.amount,
		currency: entry.currency,
		amountUsd: entry.amountUsd,
		dateKey: entry.date.toISOString().slice(0, 10),
		income: entry.income,
	});

	it("reconciles a header total with the day subtotals under it", () => {
		const header = currencyTotals(entries, "EUR", rates);
		const subtotals = [JULY_5, JULY_15].map((day) =>
			currencyTotals(
				entries.filter((entry) => entry.date === day),
				"EUR",
				rates,
			),
		);

		expect({
			header: cents(header[0].amount),
			subtotals: subtotals.map((day) => cents(day[0].amount)),
			subtotalsAdded: added(subtotals.map((day) => day[0].amount)),
			perRowAdded: added(valueRowsIn(entries.map(asValuable), "EUR", rates)),
		}).toStrictEqual({
			header: 15.91,
			subtotals: [7.74, 8.17],
			subtotalsAdded: 15.91,
			perRowAdded: 15.91,
		});
	});

	it("leaves a row already in the display currency untouched", () => {
		expect(
			valueRowsIn(
				[
					{
						amount: 12.4,
						currency: "EUR",
						amountUsd: 13.78,
						dateKey: "2026-07-15",
					},
					{
						amount: 5,
						currency: "GBP",
						amountUsd: null,
						dateKey: "2026-07-15",
					},
				],
				"EUR",
				rates,
			),
		).toStrictEqual([12.4, 5]);
	});

	it("keeps income and expense apart, as the Log's cells do", () => {
		// Rounding all four as one cell gives €0.19; the Log rounds each direction
		// separately and prints €0.20.
		const rows = [true, false].flatMap((income) =>
			Array.from({ length: 2 }, () => ({
				amount: 0.05,
				currency: "USD",
				amountUsd: 0.05,
				dateKey: "2026-07-15",
				income,
			})),
		);
		expect(added(valueRowsIn(rows, "EUR", rates))).toBe(0.2);
	});

	it("falls back to face value when no rate reaches the day", () => {
		expect(
			valueRowsIn(
				[
					{ amount: 10, currency: "USD", amountUsd: 10, dateKey: "2020-01-01" },
					{ amount: 20, currency: "USD", amountUsd: 20, dateKey: "2020-01-01" },
				],
				"EUR",
				rates,
			),
		).toStrictEqual([10, 20]);
	});
});
