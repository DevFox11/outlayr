import { describe, expect, it } from "@jest/globals";

import { mergeByRecency, toTransferLogRow } from "./transfer-log-rows";

const DAY = new Date(2026, 7, 9);

const TRANSFER = {
    date: DAY,
    day: DAY,
    exchangeRate: 55.5,
    fromAccountId: "a",
    fromAmount: 100,
    fromAmountUsd: 100,
    fromCurrency: "USD",
    id: "t1",
    note: "",
    toAccountId: "b",
    toAmount: 5550,
    toAmountUsd: 100,
    toCurrency: "VES",
};

const NAMES = new Map([
    ["a", "Zinli"],
    ["b", "Banesco"],
]);

describe("toTransferLogRow", () => {
    it("names both ends in the direction the money went", () => {
        expect(toTransferLogRow(TRANSFER, NAMES).note).toBe("Zinli → Banesco");
    });

    it("falls back to the transfer's own note when the user wrote one", () => {
        expect(toTransferLogRow({ ...TRANSFER, note: "Cambio" }, NAMES).note).toBe("Cambio");
    });

    it("carries the outbound leg, so the figure is what left", () => {
        const row = toTransferLogRow(TRANSFER, NAMES);
        expect(row.amount).toBe(100);
        expect(row.currency).toBe("USD");
    });

    it("states what left with a source fee in it, and what arrived with a destination fee out of it", () => {
        const sameCurrency = { ...TRANSFER, exchangeRate: 1, fromAmount: 98, toAmount: 98, toCurrency: "USD" };
        const atSource = toTransferLogRow(sameCurrency, NAMES, new Map([["t1", { accountId: "a", amount: 2 }]]));
        const atDestination = toTransferLogRow(TRANSFER, NAMES, new Map([["t1", { accountId: "b", amount: 50 }]]));

        expect(atSource.moved).toStrictEqual({
            arrived: 98,
            arrivedCurrency: "USD",
            fee: { amount: 2, currency: "USD" },
            outside: null,
            sent: 100,
        });
        expect(atDestination.moved).toStrictEqual({
            arrived: 5500,
            arrivedCurrency: "VES",
            fee: { amount: 50, currency: "VES" },
            outside: null,
            sent: 100,
        });
        expect(atSource.amount).toBe(98);
        expect(toTransferLogRow(TRANSFER, NAMES, new Map()).moved?.fee).toBeNull();
        expect(toTransferLogRow(TRANSFER, NAMES).moved).toBeUndefined();
    });

    it("names what arrived beyond the saved rate as money from another account, in the fee's currency", () => {
        const binance = {
            ...TRANSFER,
            exchangeRate: 957.1,
            fromAmount: 152.66,
            toAmount: 157_471.66,
        };

        expect(
            toTransferLogRow(binance, NAMES, new Map([["t1", { accountId: "a", amount: 7.34 }]])).moved?.outside
        ).toStrictEqual({
            amount: 11.87,
            currency: "USD",
        });
    });

    it("finds nothing from outside when the saved rate reproduces the arrival", () => {
        const rounded = { ...TRANSFER, exchangeRate: 957.1, fromAmount: 152.66, toAmount: 146_110.89 };
        expect(toTransferLogRow(rounded, NAMES, new Map()).moved?.outside).toBeNull();
    });

    it("finds nothing from outside in a rate saved as the ten-decimal ratio of its legs", () => {
        const dong = {
            ...TRANSFER,
            exchangeRate: 0.0000392394,
            fromAmount: 228_196_944,
            fromCurrency: "VND",
            toAmount: 8954.32,
            toCurrency: "USD",
        };
        expect(toTransferLogRow(dong, NAMES, new Map()).moved?.outside).toBeNull();
    });

    it("finds nothing from outside between two accounts in one currency", () => {
        const level = { ...TRANSFER, exchangeRate: 1, fromAmount: 100, toAmount: 105, toCurrency: "USD" };
        expect(toTransferLogRow(level, NAMES, new Map()).moved?.outside).toBeNull();
    });

    it("is excluded from day totals", () => {
        expect(toTransferLogRow(TRANSFER, NAMES).excludedFromTotals).toBe(true);
    });

    it("is marked a transfer so the row can be drawn unsigned and in transfer blue", () => {
        expect(toTransferLogRow(TRANSFER, NAMES).transferId).toBe("t1");
    });

    it("reads as an expense so nothing downstream has to learn a third direction", () => {
        expect(toTransferLogRow(TRANSFER, NAMES).income).toBe(false);
    });

    it("keeps an unknown account readable rather than blank", () => {
        expect(toTransferLogRow(TRANSFER, new Map()).note).toContain("→");
    });
});

describe("mergeByRecency", () => {
    const older = { date: new Date(2026, 7, 8), day: new Date(2026, 7, 8), id: "x" };
    const newer = { date: new Date(2026, 7, 9, 10), day: new Date(2026, 7, 9), id: "y" };
    const newest = { date: new Date(2026, 7, 9, 18), day: new Date(2026, 7, 9), id: "z" };

    it("interleaves two newest-first lists into one", () => {
        expect(mergeByRecency([newest, older], [newer]).map((row) => row.id)).toStrictEqual(["z", "y", "x"]);
    });

    it("keeps day order ahead of time order", () => {
        const lateOnOlderDay = { date: new Date(2026, 7, 8, 23), day: new Date(2026, 7, 8), id: "late" };
        expect(mergeByRecency([newer], [lateOnOlderDay]).map((row) => row.id)).toStrictEqual(["y", "late"]);
    });

    it("returns the other list untouched when one is empty", () => {
        expect(mergeByRecency([], [newer]).map((row) => row.id)).toStrictEqual(["y"]);
        expect(mergeByRecency([newer], []).map((row) => row.id)).toStrictEqual(["y"]);
    });
});
