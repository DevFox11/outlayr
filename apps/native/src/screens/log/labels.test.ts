import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import { scopeMeasureLabel } from "./labels";

const t: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

describe("scopeMeasureLabel", () => {
	it("says only the measure when the figure is in the currency asked for", () => {
		assert.equal(
			scopeMeasureLabel(t, "out", "USD", "USD"),
			t("log.measure.out"),
		);
	});

	/**
	 * The failure this exists to rule out: a scope whose entries never got a rate
	 * falls back to their own bucket, and COP's symbol is "$" exactly like USD's —
	 * so an unnamed hero reads 4,500,000 pesos as four and a half million dollars.
	 */
	it("names the currency when the figure fell back to another bucket", () => {
		const label = scopeMeasureLabel(t, "out", "COP", "USD");

		assert.equal(label, `${t("log.measure.out")} · COP`);
		assert.match(label, /COP/);
	});

	it("names the fallback for every measure, not just the promoted one", () => {
		for (const measure of ["net", "in", "out"] as const) {
			assert.match(scopeMeasureLabel(t, measure, "JPY", "EUR"), /· JPY$/);
			assert.doesNotMatch(scopeMeasureLabel(t, measure, "EUR", "EUR"), /·/);
		}
	});
});
