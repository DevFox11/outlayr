import { describe, expect, it } from "@jest/globals";

import { accountsOverview, formatSignedAmount, isMultiCurrency } from "./account-display";
import type { AccountCellRow, OverviewAccount } from "./account-display";
import type { CurrencyCell } from "./currency-totals";
import { buildRateTable } from "./valuation";

function cell(overrides: Partial<AccountCellRow> = {}): AccountCellRow {
    return {
        accountId: "a1",
        amount: 0,
        amountUsd: 0,
        count: 1,
        currencyCode: "USD",
        dateKey: "2026-06-01",
        income: false,
        unconvertedAmount: 0,
        unconvertedCount: 0,
        ...overrides,
    };
}

function account(overrides: Partial<OverviewAccount> = {}): OverviewAccount {
    return {
        currency: "USD",
        id: "a1",
        initialBalance: 0,
        initialBalanceDate: new Date("2026-06-01T12:00:00Z"),
        initialBalanceUsd: 0,
        ...overrides,
    };
}

describe("formatSignedAmount", () => {
    it("prints a negative balance with a minus and no plus otherwise", () => {
        expect(formatSignedAmount(-1240.5, "USD")).toBe("-$1,240.50");
        expect(formatSignedAmount(1240.5, "USD")).toBe("$1,240.50");
        expect(formatSignedAmount(0, "USD")).toBe("$0.00");
    });
});

describe("isMultiCurrency", () => {
    it("is true only once a foreign-currency cell exists", () => {
        expect(isMultiCurrency([], "USD")).toBe(false);
        expect(isMultiCurrency([{ amount: 5, currencyCode: "USD" }], "USD")).toBe(false);
        expect(
            isMultiCurrency(
                [
                    { amount: 5, currencyCode: "USD" },
                    { amount: 3, currencyCode: "EUR" },
                ],
                "USD"
            )
        ).toBe(true);
    });

    it("does not count a null-currency entry as foreign", () => {
        expect(isMultiCurrency([{ amount: 5, currencyCode: null }], "USD")).toBe(false);
    });
});

/** The headline figures alone; the per-account rows have their own cases below. */
function summary(result: ReturnType<typeof accountsOverview>) {
    if (result === null) {
        return null;
    }
    const { rows: _rows, ...rest } = result;
    return rest;
}

describe("accountsOverview", () => {
    const rates = buildRateTable([{ date: "2026-01-01", quote: "EUR", rate: 2 }]);

    it("is null with no accounts, so the card can hide", () => {
        expect(accountsOverview([], [], "USD", rates)).toBeNull();
    });

    it("sums same-currency accounts at face value, exactly", () => {
        const result = accountsOverview(
            [account({ id: "a1", initialBalance: 100 }), account({ id: "a2", initialBalance: 50 })],
            [
                cell({ accountId: "a1", amount: 25, amountUsd: 25 }),
                cell({ accountId: "a2", amount: 10, amountUsd: 10, income: true }),
            ],
            "USD",
            rates
        );
        expect(summary(result)).toStrictEqual({
            count: 2,
            exact: true,
            owe: 0,
            own: 100 - 25 + 50 + 10,
            total: 100 - 25 + 50 + 10,
        });
    });

    it("converts a foreign account's opening through its frozen USD value", () => {
        const result = accountsOverview(
            [account({ currency: "EUR", initialBalance: 80, initialBalanceUsd: 40 })],
            [],
            "USD",
            rates
        );
        expect(summary(result)).toStrictEqual({ count: 1, exact: true, owe: 0, own: 40, total: 40 });
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
            rates
        );
        expect(summary(result)).toStrictEqual({ count: 1, exact: false, owe: 0, own: 80, total: 80 });
    });

    it("marks approximate when a cell cannot convert", () => {
        const result = accountsOverview(
            [account({ id: "a1", initialBalance: 0 })],
            [
                cell({
                    accountId: "a1",
                    amount: 10,
                    amountUsd: 0,
                    currencyCode: "GBP",
                    unconvertedAmount: 10,
                    unconvertedCount: 1,
                }),
            ],
            "USD",
            rates
        );
        expect(result?.exact).toBe(false);
    });

    it("ignores cells for accounts not in the live list", () => {
        const result = accountsOverview(
            [account({ id: "a1", initialBalance: 5 })],
            [cell({ accountId: "tombstoned", amount: 100, amountUsd: 100 })],
            "USD",
            rates
        );
        expect(summary(result)).toStrictEqual({ count: 1, exact: true, owe: 0, own: 5, total: 5 });
    });

    it("values a whole foreign account into the display currency", () => {
        const cells: CurrencyCell[] = [];
        const result = accountsOverview(
            [account({ currency: "EUR", initialBalance: 0 }), account({ id: "a2", initialBalance: 10 })],
            cells.map((c) => ({ ...c, accountId: "a1" })),
            "USD",
            rates
        );
        expect(summary(result)).toStrictEqual({ count: 2, exact: true, owe: 0, own: 10, total: 10 });
    });

    it("tells a card apart from an overdrawn current account", () => {
        // The distinction the ledger could not make before `kind`: both are a
        // negative balance, and only one of them is a debt.
        const result = accountsOverview(
            [
                account({ id: "a1", initialBalance: -200, initialBalanceUsd: -200, kind: "liability" }),
                account({ id: "a2", initialBalance: -50, initialBalanceUsd: -50 }),
            ],
            [],
            "USD",
            rates
        );
        expect(summary(result)).toStrictEqual({ count: 2, exact: true, owe: 200, own: -50, total: -250 });
    });

    it("leaves the total untouched by the kind split", () => {
        const assets = accountsOverview(
            [account({ id: "a1", initialBalance: -200, initialBalanceUsd: -200 })],
            [],
            "USD",
            rates
        );
        const debts = accountsOverview(
            [account({ id: "a1", initialBalance: -200, initialBalanceUsd: -200, kind: "liability" })],
            [],
            "USD",
            rates
        );
        expect(debts?.total).toBe(assets?.total);
    });
});

describe("accountsOverview rows", () => {
    const rates = buildRateTable([{ date: "2026-01-01", quote: "EUR", rate: 2 }]);

    it("states every account in the ledger's order, valued and kinded", () => {
        const result = accountsOverview(
            [
                account({ id: "card", initialBalance: -200, kind: "liability" }),
                account({ currency: "EUR", id: "eur", initialBalance: 80, initialBalanceUsd: 40 }),
                account({ id: "cash", initialBalance: 30 }),
            ],
            [cell({ accountId: "cash", amount: 5, amountUsd: 5 })],
            "USD",
            rates
        );
        expect(result?.rows).toStrictEqual([
            { balance: -200, exact: true, id: "card", kind: "liability", multiCurrency: false },
            { balance: 40, exact: true, id: "eur", kind: "asset", multiCurrency: false },
            { balance: 25, exact: true, id: "cash", kind: "asset", multiCurrency: false },
        ]);
    });

    it("marks only the row that could not be valued", () => {
        const result = accountsOverview(
            [
                account({ currency: "GBP", id: "gbp", initialBalance: 80, initialBalanceUsd: null }),
                account({ id: "usd" }),
            ],
            [],
            "USD",
            rates
        );
        expect(result?.rows.map((row) => row.exact)).toStrictEqual([false, true]);
        expect(result?.exact).toBe(false);
    });

    it("flags an account holding a currency other than its own", () => {
        const result = accountsOverview(
            [account({ id: "a1" })],
            [cell({ accountId: "a1", amount: 10, amountUsd: 20, currencyCode: "EUR" })],
            "USD",
            rates
        );
        expect(result?.rows[0]?.multiCurrency).toBe(true);
    });
});
