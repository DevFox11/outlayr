import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExpenseContribution } from "@/data/budget-spent";
import { EN } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import { translate } from "@/i18n/translate";
import {
	buildDaySlots,
	categoryMedian,
	dayVerdictSentence,
} from "./budget-day-slots";
import type { BudgetWindow } from "./budget-math";

const TODAY: BudgetWindow = {
	start: new Date(2026, 6, 25),
	end: new Date(2026, 6, 26),
};

const NOW = new Date(2026, 6, 25, 18, 30);

const COFFEE = "coffee";

function expense(
	day: number,
	amount: number,
	categoryId: string | null = COFFEE,
	parentId: string | null = null,
): ExpenseContribution {
	return { amount, categoryId, parentId, date: new Date(2026, 6, day, 9) };
}

const t: TranslateFn = (key, params) =>
	translate(key, { catalog: EN, fallback: EN, params });

describe("categoryMedian", () => {
	it("ignores an outlier a mean would follow", () => {
		const rows = [
			expense(20, 10),
			expense(21, 12),
			expense(22, 11),
			expense(23, 500),
		];

		assert.equal(categoryMedian(rows, COFFEE), 11.5);
	});

	it("counts a subcategory's purchases as the parent's", () => {
		const rows = [expense(20, 8, "beans", COFFEE), expense(21, 12)];

		assert.equal(categoryMedian(rows, COFFEE), 10);
	});

	it("has nothing to say without history", () => {
		assert.equal(categoryMedian([expense(20, 10, "rent")], COFFEE), null);
	});
});

describe("buildDaySlots", () => {
	it("lays today's purchases out at what they actually cost", () => {
		const rows = [expense(24, 6), expense(25, 4), expense(25, 9)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.deepEqual(
			slots.blocks.map((block) => [block.start, block.amount, block.over]),
			[
				[0, 4, false],
				[4, 9, false],
			],
		);
		assert.equal(slots.spent, 13);
		assert.equal(slots.remaining, 7);
	});

	it("offers a slot the width of the median when one more fits", () => {
		const rows = [expense(24, 6), expense(24, 6), expense(25, 5)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.equal(slots.median, 6);
		assert.equal(slots.ghost, 6);
		assert.equal(slots.roomFor, 2);
		assert.equal(slots.verdict, "room");
		assert.equal(dayVerdictSentence(slots, "Coffee", t), "Room for one more.");
	});

	it("withholds the slot when the next typical purchase would not fit", () => {
		const rows = [expense(24, 6), expense(24, 6), expense(25, 16)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.equal(slots.median, 6);
		assert.equal(slots.ghost, null);
		assert.equal(slots.roomFor, 0);
		assert.equal(slots.verdict, "tight");
		assert.equal(
			dayVerdictSentence(slots, "Coffee", t),
			"Not enough for another.",
		);
	});

	it("draws no slot at all with no history for the category", () => {
		const rows = [expense(25, 5, "rent")];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.equal(slots.median, null);
		assert.equal(slots.ghost, null);
		assert.deepEqual(slots.blocks, []);
		assert.equal(slots.verdict, null);
		assert.equal(dayVerdictSentence(slots, "Coffee", t), null);
	});

	it("counts the purchases that landed past the limit", () => {
		const rows = [expense(25, 10), expense(25, 8), expense(25, 9)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.deepEqual(
			slots.blocks.map((block) => block.over),
			[false, false, true],
		);
		assert.equal(slots.overflow, 1);
		assert.equal(slots.remaining, -7);
		assert.equal(slots.verdict, "over");
		assert.equal(
			dayVerdictSentence(slots, "Coffee", t),
			"One Coffee too many.",
		);
	});

	it("names the count when more than one purchase overshot", () => {
		const rows = [expense(25, 18), expense(25, 6), expense(25, 6)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.equal(slots.overflow, 2);
		assert.equal(dayVerdictSentence(slots, "Coffee", t), "2 Coffee too many.");
	});

	it("spans past the limit so an overshoot stays on the bar", () => {
		const rows = [expense(25, 30)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.equal(slots.scale, 30);
	});

	it("yields no blocks on a day nothing was bought", () => {
		const rows = [expense(23, 5), expense(24, 7)];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.deepEqual(slots.blocks, []);
		assert.equal(slots.spent, 0);
		assert.equal(slots.ghost, 6);
		assert.equal(slots.scale, 20);
	});

	it("ignores purchases that have not happened yet", () => {
		const rows = [
			{
				amount: 5,
				categoryId: COFFEE,
				parentId: null,
				date: new Date(2026, 6, 25, 21),
			},
		];

		const slots = buildDaySlots(rows, {
			limit: 20,
			window: TODAY,
			now: NOW,
			categoryId: COFFEE,
		});

		assert.deepEqual(slots.blocks, []);
	});
});
