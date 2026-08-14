import type { CurrencyCell } from "./currency-totals";
import { netWorthSeries } from "./net-worth-series";
import type { NetWorthSeriesAccount } from "./net-worth-series";
import { buildRateTable } from "./valuation";

const NOW = new Date("2026-08-10T12:00:00Z");
const NO_RATES = buildRateTable([]);

function account(id: string, overrides: Partial<NetWorthSeriesAccount> = {}): NetWorthSeriesAccount {
    return {
        currency: "USD",
        id,
        initialBalance: 0,
        initialBalanceDate: new Date("2026-06-01T12:00:00Z"),
        initialBalanceUsd: null,
        ...overrides,
    };
}

function cell(overrides: Partial<CurrencyCell>): CurrencyCell {
    return {
        amount: 0,
        amountUsd: 0,
        count: 1,
        currencyCode: "USD",
        dateKey: "2026-08-01",
        income: false,
        unconvertedAmount: 0,
        unconvertedCount: 0,
        ...overrides,
    };
}

function valueAt(series: ReturnType<typeof netWorthSeries>, date: string): number {
    const point = series.find((candidate) => candidate.date === date);
    if (!point) {
        throw new Error(`Missing point for ${date}`);
    }
    return point.value;
}

describe("netWorthSeries", () => {
    it("has nothing to draw with no accounts", () => {
        expect(netWorthSeries([], new Map(), NO_RATES, NOW, "USD")).toStrictEqual([]);
    });

    it("adds every account's balance together", () => {
        const series = netWorthSeries(
            [account("a1", { initialBalance: 100 }), account("a2", { initialBalance: 50 })],
            new Map(),
            NO_RATES,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-08-10")).toBe(150);
    });

    it("nets a transfer's two legs to zero on the day it happened", () => {
        // The case that would make the chart contradict the accounts card: money
        // leaving one account and arriving in another is not a change in worth.
        const series = netWorthSeries(
            [account("a1", { initialBalance: 100 }), account("a2", { initialBalance: 0 })],
            new Map([
                ["a1", [cell({ amount: 40, amountUsd: 40, dateKey: "2026-08-05", income: false })]],
                ["a2", [cell({ amount: 40, amountUsd: 40, dateKey: "2026-08-05", income: true })]],
            ]),
            NO_RATES,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-08-05")).toBe(100);
        expect(valueAt(series, "2026-08-10")).toBe(100);
    });

    it("counts a real expense as a fall in worth", () => {
        const series = netWorthSeries(
            [account("a1", { initialBalance: 100 })],
            new Map([["a1", [cell({ amount: 30, amountUsd: 30, dateKey: "2026-08-05" })]]]),
            NO_RATES,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-08-10")).toBe(70);
    });

    it("counts a liability's negative balance against the total", () => {
        // `kind` never reaches here: a debt is already a negative balance, which is
        // what keeps the line equal to the accounts card's own total.
        const series = netWorthSeries(
            [account("a1", { initialBalance: 500 }), account("card", { initialBalance: -200 })],
            new Map(),
            NO_RATES,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-08-10")).toBe(300);
    });

    it("carries an account forward on days its own series does not cover", () => {
        const series = netWorthSeries(
            [
                account("a1", { initialBalance: 100 }),
                account("a2", { initialBalance: 40, initialBalanceDate: new Date("2026-07-01T12:00:00Z") }),
            ],
            new Map(),
            NO_RATES,
            NOW,
            "USD"
        );
        // a1 opens first at 100, a2 joins at 140. The regression this guards is a
        // day where one account's series has no point and it silently drops out —
        // which would show up as a partial sum neither of those.
        expect(valueAt(series, "2026-08-10")).toBe(140);
        expect(series.every((point) => point.value === 100 || point.value === 140)).toBe(true);
    });

    it("contributes nothing for a day before an account opened", () => {
        const series = netWorthSeries(
            [
                account("a1", { initialBalance: 100, initialBalanceDate: new Date("2026-06-01T12:00:00Z") }),
                account("later", { initialBalance: 70, initialBalanceDate: new Date("2026-08-01T12:00:00Z") }),
            ],
            new Map(),
            NO_RATES,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-07-15")).toBe(100);
        expect(valueAt(series, "2026-08-10")).toBe(170);
    });

    it("marks a day approximate when any account could not be valued", () => {
        const series = netWorthSeries(
            [account("a1", { currency: "VES", initialBalance: 100 })],
            new Map([
                [
                    "a1",
                    [
                        cell({
                            amount: 10,
                            amountUsd: 0,
                            currencyCode: "EUR",
                            dateKey: "2026-08-05",
                            unconvertedCount: 1,
                        }),
                    ],
                ],
            ]),
            NO_RATES,
            NOW,
            "USD"
        );
        const point = series.find((candidate) => candidate.date === "2026-08-05");
        expect(point?.exact).toBe(false);
    });

    it("values a foreign account into the display currency, not its own", () => {
        // The bug this guards: summing per-account series valued in each account's
        // own currency adds bolivares to dollars.
        const rates = buildRateTable([{ date: "2026-01-01", quote: "EUR", rate: 2 }]);
        const series = netWorthSeries(
            [account("eur", { currency: "EUR", initialBalance: 100, initialBalanceUsd: 50 })],
            new Map(),
            rates,
            NOW,
            "USD"
        );
        expect(valueAt(series, "2026-08-10")).toBe(50);
    });
});
