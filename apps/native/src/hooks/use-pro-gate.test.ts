import { describe, expect, it } from "@jest/globals";

import { fullAccountCaps } from "@/domain/pro-limits";

import { blocksSavedCurrency, fillsFullCap } from "./use-pro-gate";

const visa = { kind: "liability", name: "Visa" };
const cashea = { kind: "liability", name: "Cashea" };
const bothFull = fullAccountCaps(
    [{ kind: "asset", name: "Checking" }, visa, cashea, { kind: "liability", name: "Klarna" }],
    true
);

describe("saving an account on a free ledger with both caps full", () => {
    it("caps an edit that moves an account from one cap to the other", () => {
        expect(fillsFullCap(bothFull, visa, cashea)).toBe(true);
        expect(fillsFullCap(bothFull, cashea, visa)).toBe(true);
    });

    it("lets an edit that stays in its cap through", () => {
        expect(fillsFullCap(bothFull, { kind: "liability", name: "Mastercard" }, visa)).toBe(false);
        expect(fillsFullCap(bothFull, { kind: "liability", name: "Klarna" }, cashea)).toBe(false);
    });
});

describe("saving an account's currency on a free ledger", () => {
    const checking = { currency: "USD", kind: "asset", name: "Checking" };

    it("claims the currency of an installment app renamed into a plain account", () => {
        const casheaVes = { ...cashea, currency: "VES" };
        expect(blocksSavedCurrency({ ...visa, currency: "VES" }, casheaVes, [checking], true)).toBe(true);
    });

    it("lets a plain account keep its currency on a ledger already over the cap", () => {
        const savings = { currency: "VES", kind: "asset", name: "Savings" };
        expect(blocksSavedCurrency({ ...savings, name: "Ahorros" }, savings, [checking], true)).toBe(false);
    });
});
