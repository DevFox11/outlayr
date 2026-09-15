import { describe, expect, test } from "vitest";

import { entryRateType, marketRateType, PICKABLE_CURRENCY_CODES } from "./currencies";

describe("the catalog Convex validates against", () => {
    test("carries the metals, which are pickable currencies (Decision #707)", () => {
        expect(PICKABLE_CURRENCY_CODES).toContain("XAU");
        expect(PICKABLE_CURRENCY_CODES).toContain("XAG");
    });
});

describe("rate-type enum split (Decision 10)", () => {
    test("marketRateType keeps binance for the rate table and excludes custom", () => {
        const values = marketRateType.members.map((member) => member.value);
        expect(values).toContain("official");
        expect(values).toContain("eur_reference");
        expect(values).toContain("binance");
        expect(values).not.toContain("custom");
    });

    test("entryRateType drops binance for records and adds custom", () => {
        const values = entryRateType.members.map((member) => member.value);
        expect(values).toContain("official");
        expect(values).toContain("eur_reference");
        expect(values).toContain("custom");
        expect(values).not.toContain("binance");
    });
});
