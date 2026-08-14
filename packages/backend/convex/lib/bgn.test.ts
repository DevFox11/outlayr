import { describe, expect, test } from "vitest";

import { BGN_PER_EUR, bgnBaseLegToEur } from "./bgn";

describe(bgnBaseLegToEur, () => {
    test("pins Bulgaria's fixed BGN/EUR peg", () => {
        expect(BGN_PER_EUR).toBe(1.95583);
    });

    test("re-currencies a whole-EUR base leg exactly at the peg", () => {
        // 195.583 BGN / 1.95583 = 100.00 EUR; 3.91166 BGN-per-USD / 1.95583 = 2 EUR-per-USD.
        expect(bgnBaseLegToEur(195.583, 3.91166)).toStrictEqual({
            baseAmount: 100,
            baseCurrency: "EUR",
            exchangeRate: 2,
        });
    });

    test("rounds the EUR base amount half-even to two places, rate left unrounded", () => {
        // 100 BGN / 1.95583 = 51.129038... -> 51.13; rate 1.95583 / 1.95583 = 1 exactly.
        const leg = bgnBaseLegToEur(100, 1.95583);
        expect(leg.baseAmount).toBe(51.13);
        expect(leg.baseCurrency).toBe("EUR");
        expect(leg.exchangeRate).toBe(1);
    });

    test("keeps the base/rate ratio invariant so the USD canonical is preserved", () => {
        const baseAmount = 250;
        const exchangeRate = 4;
        const leg = bgnBaseLegToEur(baseAmount, exchangeRate);
        // baseAmount/exchangeRate (the canonical USD) is unchanged by the shared
        // /1.95583 divisor on both legs (baseAmount rounding aside).
        expect(leg.exchangeRate).toBe(exchangeRate / BGN_PER_EUR);
    });
});
