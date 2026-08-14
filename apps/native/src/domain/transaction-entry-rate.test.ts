import { isTransactionRateNeeded, transactionRateError, transactionRateOptions } from "./transaction-entry-rate";

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
});
