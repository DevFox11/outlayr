import { describe, expect, it } from "@jest/globals";

import { blocksNewBudget, blocksNewCurrency } from "./pro-limits";

describe("blocksNewBudget", () => {
    it("blocks a category that has no budget yet once the cap is reached", () => {
        expect(blocksNewBudget("groceries", ["rent", "transport"], true)).toBe(true);
    });

    it("never blocks editing a budget that already exists", () => {
        expect(blocksNewBudget("rent", ["rent", "transport"], true)).toBe(false);
    });

    it("never blocks the overall budget, which is a singleton rather than a slot", () => {
        expect(blocksNewBudget(null, ["rent", "transport"], true)).toBe(false);
    });

    it("blocks nothing while the caller is under the cap", () => {
        expect(blocksNewBudget("groceries", ["rent"], false)).toBe(false);
    });
});

describe("blocksNewCurrency", () => {
    it("lets the first account pick anything", () => {
        expect(blocksNewCurrency("VES", [], true)).toBe(false);
    });

    it("blocks a second currency once one is in use", () => {
        expect(blocksNewCurrency("VES", ["USD"], true)).toBe(true);
    });

    it("never blocks a currency the ledger already holds", () => {
        expect(blocksNewCurrency("USD", ["USD", "VES"], true)).toBe(false);
    });

    it("blocks nothing while Pro is unlocked or unsellable", () => {
        expect(blocksNewCurrency("VES", ["USD"], false)).toBe(false);
    });
});
