import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import { insightsVerdict, type VerdictInput } from "./insights-verdict";

const t: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

const base: VerdictInput = {
	measure: "spent",
	current: 1200,
	prior: 1000,
	priorLabel: "2025",
	topMover: null,
	code: "USD",
	showCents: false,
	t,
};

describe("insightsVerdict", () => {
	it("says nothing at all when there is no prior window", () => {
		const verdict = insightsVerdict({ ...base, prior: 0 });
		assert.equal(verdict.badge, null);
		assert.equal(verdict.sentence, null);
	});

	it("reports the change in currency, not only as a percentage", () => {
		const verdict = insightsVerdict(base);
		assert.match(verdict.sentence ?? "", /200/);
		assert.match(verdict.sentence ?? "", /more than 2025/);
	});

	it("signs the badge", () => {
		assert.equal(insightsVerdict(base).badge, "+20%");
		assert.equal(insightsVerdict({ ...base, current: 800 }).badge, "-20%");
	});

	it("treats spending more as unfavourable and spending less as favourable", () => {
		assert.equal(insightsVerdict(base).favourable, false);
		assert.equal(insightsVerdict({ ...base, current: 800 }).favourable, true);
	});

	it("treats earning more as favourable", () => {
		const verdict = insightsVerdict({ ...base, measure: "income" });
		assert.equal(verdict.favourable, true);
	});

	it("treats a rising net as favourable and a falling one as not", () => {
		assert.equal(insightsVerdict({ ...base, measure: "net" }).favourable, true);
		assert.equal(
			insightsVerdict({ ...base, measure: "net", current: 800 }).favourable,
			false,
		);
	});

	it("handles a net that crossed from positive to negative", () => {
		const verdict = insightsVerdict({
			...base,
			measure: "net",
			current: -300,
			prior: 500,
		});
		assert.equal(verdict.favourable, false);
		assert.match(verdict.sentence ?? "", /800/, "the swing is 800, not 200");
	});

	it("calls a window within two percent the same rather than manufacturing news", () => {
		const verdict = insightsVerdict({ ...base, current: 1010 });
		assert.equal(verdict.sentence, "In line with 2025.");
		assert.equal(
			verdict.favourable,
			true,
			"a flat window is not bad news even when spending ticked up",
		);
	});

	it("names the loudest mover when there is one", () => {
		const verdict = insightsVerdict({
			...base,
			topMover: { name: "Dinner", delta: 150 },
		});
		assert.match(verdict.sentence ?? "", /Dinner alone added/);
	});

	it("says a falling mover gave money back rather than added it", () => {
		const verdict = insightsVerdict({
			...base,
			current: 800,
			topMover: { name: "Transport", delta: -220 },
		});
		assert.match(verdict.sentence ?? "", /Transport alone gave back/);
	});

	it("keeps the sentence to two clauses", () => {
		const verdict = insightsVerdict({
			...base,
			topMover: { name: "Dinner", delta: 150 },
		});
		const sentences = (verdict.sentence ?? "")
			.split(".")
			.filter((part) => part.trim().length > 0);
		assert.equal(sentences.length, 2);
	});

	it("never emits a stray minus inside the amount", () => {
		const verdict = insightsVerdict({ ...base, current: 500 });
		assert.doesNotMatch(
			verdict.sentence ?? "",
			/-/,
			"the direction is a word, so the amount stays unsigned",
		);
	});
});
