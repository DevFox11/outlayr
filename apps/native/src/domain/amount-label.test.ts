import { EN, ES } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import { rowAmountLabel } from "./amount-label";

const en: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

const es: TranslateFn = (key, params) =>
	translate(key, { catalog: ES, fallback: EN, params });

const USD = { code: "USD", amount: 1240.5 };

/**
 * The defect this guards: "Display +/- Symbol" is one tap away in Settings, and
 * with it off the printed sign is gone — hue is then the only thing separating an
 * income row from an expense row on Log, Search, Insights and Budget detail. The
 * setting is allowed to govern the glyph; it must never reach the accessible name.
 */
describe("rowAmountLabel states direction whatever the sign setting says", () => {
	for (const showSign of [true, false]) {
		it(`names income in words with showSign=${showSign}`, () => {
			const label = rowAmountLabel({ ...USD, income: true, showSign }, en);

			expect(label).toMatch(/Income/);
		});

		it(`names an expense in words with showSign=${showSign}`, () => {
			const label = rowAmountLabel({ ...USD, income: false, showSign }, en);

			expect(label).toMatch(/Expense/);
		});
	}

	it("returns the same name whether the sign is printed or not", () => {
		for (const income of [true, false]) {
			expect(rowAmountLabel({ ...USD, income, showSign: true }, en)).toBe(
				rowAmountLabel({ ...USD, income, showSign: false }, en),
			);
		}
	});

	it("distinguishes the two directions, so hue is never the only cue", () => {
		expect(
			rowAmountLabel({ ...USD, income: true, showSign: false }, en),
		).not.toBe(rowAmountLabel({ ...USD, income: false, showSign: false }, en));
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
		expect(
			rowAmountLabel({ code: "EUR", amount: 12, income: false }, en),
		).toMatch(/€12\.00/);
		// A zero-minor-unit code has no fraction to read out at all.
		expect(
			rowAmountLabel({ code: "JPY", amount: 1240, income: false }, en),
		).toBe("Expense ¥1,240");
	});

	/** 1240.50 lands on 1240, not 1241: `roundMoney` is half-even. */
	it("drops the cents when the display setting does", () => {
		expect(
			rowAmountLabel({ ...USD, income: false, showCents: false }, en),
		).toBe("Expense $1,240");
	});

	/**
	 * `income` is the direction of record, so a stored magnitude that happens to be
	 * negative must not smuggle a second, contradicting sign into the sentence.
	 */
	it("never doubles the sign for a negative magnitude", () => {
		expect(
			rowAmountLabel({ code: "USD", amount: -1240.5, income: false }, en),
		).toBe(rowAmountLabel({ code: "USD", amount: 1240.5, income: false }, en));
	});

	it("resolves both keys rather than leaking them", () => {
		for (const income of [true, false]) {
			const label = rowAmountLabel({ ...USD, income }, en);

			expect(label).not.toMatch(/log\.row\.amount/);
			expect(label).not.toMatch(/\{amount\}/);
		}
	});
});
