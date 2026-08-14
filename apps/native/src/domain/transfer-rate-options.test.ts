import { marketRateFor, rateTypeOptions } from "./transfer-rate-options";
import { buildRateTable } from "./valuation";

const RATES = buildRateTable([
    { date: "2026-08-01", quote: "VES", rate: 40.12 },
    { date: "2026-08-01", quote: "BRL", rate: 5.423 },
]);
const DAY = new Date(Date.UTC(2026, 7, 9));

describe("rateTypeOptions", () => {
    it("always offers the official rate", () => {
        expect(rateTypeOptions("BRL")).toContain("official");
    });

    it("always offers a custom rate, because only the user knows what they transacted at", () => {
        expect(rateTypeOptions("BRL")).toContain("custom");
    });

    it("offers the EUR reference only for bolívares", () => {
        expect(rateTypeOptions("VES")).toContain("eur_reference");
    });

    it("withholds the EUR reference from every other currency, because resolveEntryRate throws for them", () => {
        expect(rateTypeOptions("BRL")).not.toContain("eur_reference");
        expect(rateTypeOptions("EUR")).not.toContain("eur_reference");
    });

    it("never offers binance, which is VES-per-USDT and not a currency rate at all", () => {
        expect(rateTypeOptions("VES")).not.toContain("binance");
    });

    it("puts official first so the default needs no lookup", () => {
        expect(rateTypeOptions("VES")[0]).toBe("official");
    });
});

describe("marketRateFor", () => {
    it("converts one unit of the source currency into the destination", () => {
        expect(marketRateFor("USD", "VES", DAY, RATES)).toBeCloseTo(40.12, 6);
    });

    it("is 1 when both sides share a currency", () => {
        expect(marketRateFor("USD", "USD", DAY, RATES)).toBe(1);
    });

    it("crosses two non-USD currencies through their USD legs", () => {
        const rate = marketRateFor("BRL", "VES", DAY, RATES);
        expect(rate).toBeCloseTo(40.12 / 5.423, 6);
    });

    it("inverts when the destination is USD", () => {
        expect(marketRateFor("VES", "USD", DAY, RATES)).toBeCloseTo(1 / 40.12, 6);
    });

    it("returns null when a currency has no rate that day", () => {
        expect(marketRateFor("USD", "JPY", DAY, RATES)).toBeNull();
    });

    it("returns null rather than a zero or negative rate", () => {
        const broken = buildRateTable([{ date: "2026-08-01", quote: "ZWL", rate: 0 }]);
        expect(marketRateFor("USD", "ZWL", DAY, broken)).toBeNull();
    });
});
