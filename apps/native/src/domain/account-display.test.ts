import {
	type AccountCellRow,
	accountsOverview,
	formatSignedAmount,
	isMultiCurrency,
	type OverviewAccount,
} from "./account-display";
import type { CurrencyCell } from "./currency-totals";
import { buildRateTable } from "./valuation";

function cell(overrides: Partial<AccountCellRow> = {}): AccountCellRow {
	return {
		accountId: "a1",
		currencyCode: "USD",
		dateKey: "2026-06-01",
		income: false,
		amount: 0,
		amountUsd: 0,
		unconvertedAmount: 0,
		count: 1,
		unconvertedCount: 0,
		...overrides,
	};
}

function account(overrides: Partial<OverviewAccount> = {}): OverviewAccount {
	return {
		id: "a1",
		currency: "USD",
		initialBalance: 0,
		initialBalanceUsd: 0,
		initialBalanceDate: new Date("2026-06-01T12:00:00Z"),
		...overrides,
	};
}

describe("formatSignedAmount", () => {
	it("prints a negative balance with a minus and no plus otherwise", () => {
		expect(formatSignedAmount(-1240.5, "USD")).toBe("-$1,240.50");
		expect(formatSignedAmount(1240.5, "USD")).toBe("$1,240.50");
		expect(formatSignedAmount(0, "USD")).toBe("$0.00");
	});

	it("keeps the sign ahead of a language that trails its symbol", () => {
		expect(formatSignedAmount(-1240.5, "EUR", true, "es")).toBe(
			"-1.240,50\u00a0\u20ac",
		);
	});
});

describe("isMultiCurrency", () => {
	it("is true only once a foreign-currency cell exists", () => {
		expect(isMultiCurrency([], "USD")).toBe(false);
		expect(isMultiCurrency([{ currencyCode: "USD", amount: 5 }], "USD")).toBe(
			false,
		);
		expect(
			isMultiCurrency(
				[
					{ currencyCode: "USD", amount: 5 },
					{ currencyCode: "EUR", amount: 3 },
				],
				"USD",
			),
		).toBe(true);
	});

	it("does not count a null-currency entry as foreign", () => {
		expect(isMultiCurrency([{ currencyCode: null, amount: 5 }], "USD")).toBe(
			false,
		);
	});
});

describe("accountsOverview", () => {
	const rates = buildRateTable([{ quote: "EUR", date: "2026-01-01", rate: 2 }]);

	it("is null with no accounts, so the card can hide", () => {
		expect(accountsOverview([], [], "USD", rates)).toBeNull();
	});

	it("sums same-currency accounts at face value, exactly", () => {
		const result = accountsOverview(
			[
				account({ id: "a1", initialBalance: 100 }),
				account({ id: "a2", initialBalance: 50 }),
			],
			[
				cell({ accountId: "a1", amount: 25, amountUsd: 25 }),
				cell({ accountId: "a2", amount: 10, amountUsd: 10, income: true }),
			],
			"USD",
			rates,
		);
		expect(result).toEqual({
			count: 2,
			total: 100 - 25 + 50 + 10,
			exact: true,
		});
	});

	it("converts a foreign account's opening through its frozen USD value", () => {
		const result = accountsOverview(
			[account({ currency: "EUR", initialBalance: 80, initialBalanceUsd: 40 })],
			[],
			"USD",
			rates,
		);
		expect(result).toEqual({ count: 1, total: 40, exact: true });
	});

	it("falls back to face value and marks approximate when no rate reaches", () => {
		const result = accountsOverview(
			[
				account({
					currency: "GBP",
					initialBalance: 80,
					initialBalanceUsd: null,
				}),
			],
			[],
			"USD",
			rates,
		);
		expect(result).toEqual({ count: 1, total: 80, exact: false });
	});

	it("marks approximate when a cell cannot convert", () => {
		const result = accountsOverview(
			[account({ id: "a1", initialBalance: 0 })],
			[
				cell({
					accountId: "a1",
					currencyCode: "GBP",
					amount: 10,
					amountUsd: 0,
					unconvertedAmount: 10,
					unconvertedCount: 1,
				}),
			],
			"USD",
			rates,
		);
		expect(result?.exact).toBe(false);
	});

	it("ignores cells for accounts not in the live list", () => {
		const result = accountsOverview(
			[account({ id: "a1", initialBalance: 5 })],
			[cell({ accountId: "tombstoned", amount: 100, amountUsd: 100 })],
			"USD",
			rates,
		);
		expect(result).toEqual({ count: 1, total: 5, exact: true });
	});

	it("values a whole foreign account into the display currency", () => {
		const cells: CurrencyCell[] = [];
		const result = accountsOverview(
			[
				account({ currency: "EUR", initialBalance: 0 }),
				account({ id: "a2", initialBalance: 10 }),
			],
			cells.map((c) => ({ ...c, accountId: "a1" })),
			"USD",
			rates,
		);
		expect(result).toEqual({ count: 2, total: 10, exact: true });
	});
});
