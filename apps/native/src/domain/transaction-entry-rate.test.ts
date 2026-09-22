import { describe, expect, it } from "@jest/globals";

import {
    flipRateForQuote,
    formatQuotedRate,
    isTransactionRateNeeded,
    rateQuoteUnit,
    transactionRateError,
    transactionRateOptions,
} from "./transaction-entry-rate";

describe("transaction entry rate policy", () => {
    it("offers official and custom for every non-USD currency, adding EUR reference only for VES", () => {
        expect(transactionRateOptions("EUR")).toStrictEqual(["official", "custom"]);
        expect(transactionRateOptions("VES")).toStrictEqual(["official", "eur_reference", "custom"]);
        expect(transactionRateOptions("USD")).toStrictEqual([]);
    });

    it("requires a finite positive actual rate for a plain custom selection", () => {
        expect(transactionRateError("VES", { exchangeRate: null, exchangeRateType: "custom" })).toBe(
            "customRateRequired"
        );
        expect(transactionRateError("VES", { exchangeRate: 0, exchangeRateType: "custom" })).toBe("customRateRequired");
        expect(transactionRateError("VES", { exchangeRate: 55.5, exchangeRateType: "custom" })).toBeNull();
    });

    it("recognises only the nullable custom canonical triple as rate-needed", () => {
        expect(isTransactionRateNeeded({ amountUsd: null, exchangeRate: null, exchangeRateType: "custom" })).toBe(true);
        expect(isTransactionRateNeeded({ amountUsd: null, exchangeRate: null, exchangeRateType: "official" })).toBe(
            false
        );
        expect(isTransactionRateNeeded({ amountUsd: 100, exchangeRate: 55.5, exchangeRateType: "custom" })).toBe(false);
    });

    it("quotes EUR, GBP and its pegs, AUD, NZD and metals in USD per unit, and every other currency per USD", () => {
        expect(rateQuoteUnit("EUR")).toStrictEqual({ base: "EUR", quote: "USD" });
        expect(rateQuoteUnit("NZD")).toStrictEqual({ base: "NZD", quote: "USD" });
        expect(rateQuoteUnit("VES")).toStrictEqual({ base: "USD", quote: "VES" });
        expect(rateQuoteUnit("GIP")).toStrictEqual({ base: "GIP", quote: "USD" });
        expect(formatQuotedRate("XAU", 1 / 3500)).toBe("3500");
        expect(formatQuotedRate("EUR", 0.87113)).toBe("1.1479");
        expect(formatQuotedRate("VES", 55.555555)).toBe("55.5556");
    });

    it("flips only a positive rate of a USD-quoted currency", () => {
        expect(flipRateForQuote("EUR", 0.8)).toBe(1.25);
        expect(flipRateForQuote("EUR", 1.25)).toBe(0.8);
        expect(flipRateForQuote("VES", 55.5)).toBe(55.5);
        expect(flipRateForQuote("EUR", 0)).toBe(0);
    });
});
