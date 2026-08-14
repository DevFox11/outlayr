import { describe, expect, it } from "@jest/globals";

import {
    amountDigits,
    amountParts,
    formatAmount,
    minorUnitsFor,
    NBSP,
    numberLocale,
    roundToMinorUnits,
    splitSymbol,
    withCurrencySymbol,
} from "./money";

describe("numberLocale", () => {
    it("gives English a leading symbol and a dot decimal", () => {
        expect(numberLocale("en")).toMatchObject({
            decimal: ".",
            gap: "",
            group: ",",
            placement: "prefix",
        });
    });

    it("gives Spanish a trailing symbol and a comma decimal", () => {
        expect(numberLocale("es")).toMatchObject({
            decimal: ",",
            gap: NBSP,
            group: ".",
            placement: "suffix",
        });
    });
});

describe("formatAmount", () => {
    it("groups and places the symbol per language", () => {
        expect(formatAmount(1234.5, "USD", true, "en")).toBe("$1,234.50");
        expect(formatAmount(1234.5, "EUR", true, "es")).toBe(`1.234,50${NBSP}€`);
    });

    it("separates a trailing symbol with a non-breaking space", () => {
        expect(formatAmount(1, "EUR", true, "es")).not.toContain(" €");
        expect(formatAmount(1, "EUR", true, "es")).toContain(`${NBSP}€`);
    });

    it("emits no fraction for a zero-minor-unit currency", () => {
        expect(formatAmount(1234, "JPY", true, "en")).toBe("¥1,234");
        expect(formatAmount(1234, "JPY", true, "es")).toBe(`1.234${NBSP}¥`);
    });

    it("drops the fraction when cents are switched off", () => {
        expect(formatAmount(1234.56, "USD", false, "en")).toBe("$1,235");
        expect(formatAmount(1234.56, "EUR", false, "es")).toBe(`1.235${NBSP}€`);
    });

    it("groups every three digits past a thousand", () => {
        expect(formatAmount(1_234_567.89, "USD", true, "en")).toBe("$1,234,567.89");
        expect(formatAmount(1_234_567.89, "EUR", true, "es")).toBe(`1.234.567,89${NBSP}€`);
    });
});

describe("amountParts", () => {
    it("carries the locale so callers assemble their own strings correctly", () => {
        expect(amountParts(12.34, "EUR", true, "es")).toMatchObject({
            fraction: "34",
            integer: "12",
            minorUnits: 2,
            symbol: "€",
        });
    });

    it("reports the minor units the code actually stores", () => {
        expect(amountParts(1, "JPY", true, "en").minorUnits).toBe(0);
        expect(amountParts(1, "KWD", true, "en").minorUnits).toBe(3);
        expect(minorUnitsFor("KWD")).toBe(3);
    });
});

describe("amountDigits", () => {
    it("joins the fraction with the language's decimal mark", () => {
        expect(amountDigits(amountParts(1234.5, "USD", true, "en"))).toBe("1,234.50");
        expect(amountDigits(amountParts(1234.5, "EUR", true, "es"))).toBe("1.234,50");
    });

    it("omits the mark entirely when there is no fraction", () => {
        expect(amountDigits(amountParts(1234, "JPY", true, "es"))).toBe("1.234");
    });
});

describe("splitSymbol", () => {
    it("fills exactly one side, so a hero can style the symbol apart", () => {
        expect(splitSymbol(amountParts(1, "USD", true, "en"))).toStrictEqual({
            prefixSymbol: "$",
            suffixSymbol: "",
        });
        expect(splitSymbol(amountParts(1, "EUR", true, "es"))).toStrictEqual({
            prefixSymbol: "",
            suffixSymbol: `${NBSP}€`,
        });
    });

    it("agrees with withCurrencySymbol", () => {
        for (const language of ["en", "es"] as const) {
            const parts = amountParts(1234.5, "EUR", true, language);
            const { prefixSymbol, suffixSymbol } = splitSymbol(parts);
            const digits = amountDigits(parts);
            expect(`${prefixSymbol}${digits}${suffixSymbol}`).toBe(withCurrencySymbol(parts, digits));
        }
    });
});

describe("roundToMinorUnits", () => {
    it("clamps precision to what the currency can hold", () => {
        expect(roundToMinorUnits(12.34, "JPY")).toBe(12);
        expect(roundToMinorUnits(12.345, "USD")).toBe(12.34);
        expect(roundToMinorUnits(12.3456, "KWD")).toBe(12.346);
    });
});
