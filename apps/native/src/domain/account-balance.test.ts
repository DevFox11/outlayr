import { accountBalance } from "./account-balance";
import type { CurrencyCell } from "./currency-totals";
import { buildRateTable } from "./valuation";

function cell(overrides: Partial<CurrencyCell>): CurrencyCell {
	return {
		currencyCode: "USD",
		dateKey: "2026-01-05",
		income: false,
		amount: 0,
		amountUsd: 0,
		unconvertedAmount: 0,
		count: 1,
		unconvertedCount: 0,
		...overrides,
	};
}

const NO_RATES = buildRateTable([]);

describe("accountBalance", () => {
	it("adds income and subtracts expense at face value in the account currency", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: 100 },
			[
				cell({ income: true, amount: 50, amountUsd: 50 }),
				cell({ income: false, amount: 30, amountUsd: 30 }),
			],
			NO_RATES,
		);

		expect(result.total).toBe(120);
		expect(result.exact).toBe(true);
		expect(result.composition).toStrictEqual([
			{ currencyCode: "USD", amount: 20 },
		]);
	});

	it("values a foreign cell through its frozen USD sum at the day's rate", () => {
		const rates = buildRateTable([
			{ quote: "EUR", date: "2026-01-01", rate: 0.8 },
		]);

		const result = accountBalance(
			{ currency: "EUR", initialBalance: 100 },
			[
				cell({
					currencyCode: "USD",
					income: false,
					amount: 10,
					amountUsd: 10,
				}),
			],
			rates,
		);

		// 10 USD × 0.8 EUR/USD = 8 EUR off a 100 EUR opening balance.
		expect(result.total).toBe(92);
		expect(result.exact).toBe(true);
		expect(result.composition).toStrictEqual([
			{ currencyCode: "USD", amount: -10 },
		]);
	});

	it("mixes same-currency and foreign cells into one USD total", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: 0 },
			[
				cell({ currencyCode: "USD", income: true, amount: 10, amountUsd: 10 }),
				cell({ currencyCode: "EUR", income: false, amount: 20, amountUsd: 25 }),
			],
			NO_RATES,
		);

		expect(result.total).toBe(-15);
		expect(result.exact).toBe(true);
		expect(result.composition).toStrictEqual([
			{ currencyCode: "USD", amount: 10 },
			{ currencyCode: "EUR", amount: -20 },
		]);
	});

	it("falls back to face value and reports inexact when no rate reaches the cell", () => {
		const result = accountBalance(
			{ currency: "EUR", initialBalance: 100 },
			[cell({ currencyCode: "GBP", income: false, amount: 5, amountUsd: 6 })],
			NO_RATES,
		);

		expect(result.total).toBe(95);
		expect(result.exact).toBe(false);
		expect(result.composition).toStrictEqual([
			{ currencyCode: "GBP", amount: -5 },
		]);
	});

	it("reports inexact when a foreign cell carries unconverted rows", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: 0 },
			[
				cell({
					currencyCode: "EUR",
					income: false,
					amount: 27,
					amountUsd: 25,
					unconvertedAmount: 7,
					count: 3,
					unconvertedCount: 1,
				}),
			],
			NO_RATES,
		);

		expect(result.total).toBe(-32);
		expect(result.exact).toBe(false);
	});

	it("carries a negative opening balance", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: -50 },
			[cell({ income: true, amount: 20, amountUsd: 20 })],
			NO_RATES,
		);

		expect(result.total).toBe(-30);
		expect(result.exact).toBe(true);
	});

	it("places a currency-less cell through its USD value, never at face value", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: 0 },
			[cell({ currencyCode: null, income: true, amount: 999, amountUsd: 12 })],
			NO_RATES,
		);

		expect(result.total).toBe(12);
		expect(result.exact).toBe(true);
		expect(result.composition).toStrictEqual([
			{ currencyCode: null, amount: 999 },
		]);
	});

	it("is zero-shaped for an account with no entries", () => {
		const result = accountBalance(
			{ currency: "USD", initialBalance: 0 },
			[],
			NO_RATES,
		);

		expect(result).toStrictEqual({ total: 0, exact: true, composition: [] });
	});
});
