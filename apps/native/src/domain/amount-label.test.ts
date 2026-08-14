import { EN, ES } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";

import { rowAmountLabel } from "./amount-label";

const en: TranslateFn = (key, params) => translate(key, { catalog: EN, fallback: EN, params });

const es: TranslateFn = (key, params) => translate(key, { catalog: ES, fallback: EN, params });

const USD = { amount: 1240.5, code: "USD" };

/**
 * A row separates money in from money out with a `+`/`-` glyph and a hue, and a
 * screen reader conveys neither. The direction has to be a word in the name.
 */
describe("rowAmountLabel states the direction in words", () => {
    it("names income", () => {
        expect(rowAmountLabel({ ...USD, income: true }, en)).toMatch(/Income/);
    });

    it("names an expense", () => {
        expect(rowAmountLabel({ ...USD, income: false }, en)).toMatch(/Expense/);
    });

    it("distinguishes the two directions, so hue is never the only cue", () => {
        expect(rowAmountLabel({ ...USD, income: true }, en)).not.toBe(rowAmountLabel({ ...USD, income: false }, en));
    });

    it("keeps the direction in Spanish too", () => {
        expect(rowAmountLabel({ ...USD, income: true }, es)).toMatch(/Ingreso/);
        expect(rowAmountLabel({ ...USD, income: false }, es)).toMatch(/Gasto/);
    });
});

describe("rowAmountLabel carries the figure it labels", () => {
    it("reads the grouped amount with its currency mark", () => {
        const label = rowAmountLabel({ ...USD, income: false }, en);

        expect(label).toBe("Expense $1,240.50");
    });

    it("uses the row's own currency, not a fixed one", () => {
        expect(rowAmountLabel({ amount: 12, code: "EUR", income: false }, en)).toMatch(/€12\.00/);
        // A zero-minor-unit code has no fraction to read out at all.
        expect(rowAmountLabel({ amount: 1240, code: "JPY", income: false }, en)).toBe("Expense ¥1,240");
    });

    /** 1240.50 lands on 1240, not 1241: `roundMoney` is half-even. */
    it("drops the cents when the display setting does", () => {
        expect(rowAmountLabel({ ...USD, income: false, showCents: false }, en)).toBe("Expense $1,240");
    });

    /**
     * `income` is the direction of record, so a stored magnitude that happens to be
     * negative must not smuggle a second, contradicting sign into the sentence.
     */
    it("never doubles the sign for a negative magnitude", () => {
        expect(rowAmountLabel({ amount: -1240.5, code: "USD", income: false }, en)).toBe(
            rowAmountLabel({ amount: 1240.5, code: "USD", income: false }, en)
        );
    });

    it("resolves both keys rather than leaking them", () => {
        for (const income of [true, false]) {
            const label = rowAmountLabel({ ...USD, income }, en);

            expect(label).not.toMatch(/log\.row\.amount/);
            expect(label).not.toMatch(/\{amount\}/);
        }
    });
});
