import { describe, expect, it } from "@jest/globals";
import { buildRateTable } from "@outlayr/money/valuation";

import { payoffLines } from "./payoff-plans";
import type { SavingsGoal } from "./savings-goals-core";

const SET = new Date(2026, 8, 1);
const NOW = new Date(2026, 9, 18, 12).getTime();

// Ana owed Bs 1,000 when the plan was set, at 40 a dollar; the bolivar is now at 80.
const plan: SavingsGoal = {
    accountId: "ana",
    currency: "VES",
    dateCreated: SET,
    deletedAt: null,
    exchangeRate: 40,
    id: "plan",
    name: "Ana",
    sortOrder: 0,
    startAmount: 1000,
    startAmountUsd: 25,
    targetAmount: 0,
    targetAmountUsd: 0,
    targetDate: new Date(2026, 11, 1),
    updatedAt: SET,
};
const rates = buildRateTable([
    { date: "2026-09-01", quote: "VES", rate: 40 },
    { date: "2026-10-01", quote: "VES", rate: 80 },
]);
const row = (balance: number, exact = true) => ({
    balance,
    exact,
    id: "ana",
    kind: "person" as const,
    multiCurrency: false,
});

describe("payoffLines", () => {
    it("reads a debt in a currency that fell as unpaid until it is paid", () => {
        // Still Bs 1,000, now $12.50. Against the $25 it was frozen at, half would read as paid.
        const line = payoffLines([plan], [row(12.5)], { displayCurrency: "USD", rates }, NOW).get("ana");
        expect(line?.fraction).toBe(0);
        expect(line?.reached).toBe(false);
    });

    it("draws no fill before the rates arrive, rather than paid off", () => {
        // With no rate the balance and the start both read zero.
        const noRates = { displayCurrency: "USD", rates: buildRateTable([]) };
        const line = payoffLines([plan], [row(0, false)], noRates, NOW).get("ana");
        expect(line).toMatchObject({ fraction: null, reached: false, tick: null });
    });
});
