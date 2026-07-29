import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type CategoryBreakdownEntry,
	type CategoryMeta,
	categoryBreakdownWithin,
	categoryMovers,
	type InsightsBucket,
	type InsightsContribution,
	runningTotals,
	withCategoryDeltas,
} from "./insights";

function entry(
	id: string,
	amount: number,
	fraction = 0,
): CategoryBreakdownEntry {
	return {
		id,
		name: id,
		color: "#000000",
		icon: null,
		emoji: null,
		amount,
		fraction,
		delta: null,
	};
}

describe("runningTotals", () => {
	const bucket = (value: number, day: number): InsightsBucket => ({
		start: new Date(2025, 6, day),
		end: new Date(2025, 6, day + 1),
		label: String(day),
		value,
	});

	it("carries each slot forward", () => {
		const series = [bucket(10, 1), bucket(-4, 2), bucket(6, 3)];
		assert.deepEqual(runningTotals(series), [10, 6, 12]);
	});

	it("ends on the window's own total, so the line lands on the hero figure", () => {
		const series = [bucket(-500, 1), bucket(2000, 2), bucket(-300, 3)];
		const totals = runningTotals(series);
		const sum = series.reduce((acc, b) => acc + b.value, 0);
		assert.equal(totals.at(-1), sum);
	});

	it("stays well-scaled where per-slot net collapses", () => {
		// A salaried month: two paydays, twenty-nine ordinary spending days.
		const series = Array.from({ length: 31 }, (_, index) =>
			bucket(index === 11 || index === 25 ? 248_200 : -2500, index + 1),
		);
		const perSlot = series.map((b) => b.value);
		const slotSpan = Math.max(...perSlot) - Math.min(...perSlot);
		assert.ok(
			2500 / slotSpan < 0.01,
			"an ordinary day is under 1% of the span",
		);

		const totals = runningTotals(series);
		const runSpan = Math.max(...totals) - Math.min(...totals);
		assert.ok(
			2500 / runSpan > 0.005,
			"the running balance gives an ordinary day real height",
		);
	});

	it("returns nothing for an empty window rather than a stray zero", () => {
		assert.deepEqual(runningTotals([]), []);
	});
});

describe("categoryMovers", () => {
	it("says nothing when there is no prior window to compare against", () => {
		// The first window a new user opens has no history behind it.
		assert.deepEqual(categoryMovers([entry("a", 500)], [], 500), []);
	});

	it("ranks on currency, not on percentage", () => {
		// 10 -> 30 is +200% and trivial; 4000 -> 4800 is +20% and is where the
		// window actually went.
		const current = [entry("rent", 4800), entry("gum", 30)];
		const prior = [entry("rent", 4000), entry("gum", 10)];
		const movers = categoryMovers(current, prior, 4830);

		assert.equal(movers[0].id, "rent");
		assert.equal(
			movers.length,
			1,
			"gum is below the floor and must not appear",
		);
	});

	it("drops anything moving less than 5% of the window", () => {
		const current = [entry("a", 1020)];
		const prior = [entry("a", 1000)];
		// A $20 move on a $1,020 window is 2% — noise.
		assert.deepEqual(categoryMovers(current, prior, 1020), []);
	});

	it("keeps a move that clears the floor", () => {
		const current = [entry("a", 1100)];
		const prior = [entry("a", 1000)];
		const movers = categoryMovers(current, prior, 1100);
		assert.equal(movers.length, 1);
		assert.equal(movers[0].delta, 100);
	});

	it("reports a category that stopped entirely", () => {
		// It cannot be found by walking the current window, which no longer has it.
		const movers = categoryMovers([entry("a", 1000)], [entry("b", 900)], 1000);
		const stopped = movers.find((mover) => mover.id === "b");
		assert.ok(stopped, "a category that went to zero should still be a mover");
		assert.equal(stopped.delta, -900);
		assert.equal(stopped.fraction, -1);
	});

	it("leaves a brand-new category's fraction null rather than +100%", () => {
		const movers = categoryMovers(
			[entry("new", 800)],
			[entry("old", 800)],
			800,
		);
		const fresh = movers.find((mover) => mover.id === "new");
		assert.ok(fresh);
		assert.equal(fresh.delta, 800);
		assert.equal(
			fresh.fraction,
			null,
			"a category that did not exist did not grow by a percentage",
		);
	});

	it("caps at three so the strip cannot crowd out the chart", () => {
		const current = [
			entry("a", 500),
			entry("b", 400),
			entry("c", 300),
			entry("d", 200),
			entry("e", 100),
		];
		const prior = [
			entry("a", 1),
			entry("b", 1),
			entry("c", 1),
			entry("d", 1),
			entry("e", 1),
		];
		assert.equal(categoryMovers(current, prior, 1500).length, 3);
	});

	it("orders by magnitude regardless of direction", () => {
		const current = [entry("up", 300), entry("down", 100)];
		const prior = [entry("up", 100), entry("down", 900)];
		const movers = categoryMovers(current, prior, 400);
		assert.equal(movers[0].id, "down", "-800 outranks +200");
		assert.ok(movers[0].delta < 0);
	});

	it("stays quiet on an empty window rather than dividing by it", () => {
		assert.deepEqual(categoryMovers([], [entry("a", 100)], 0), []);
	});
});

describe("withCategoryDeltas", () => {
	it("expresses the change as a fraction of what came before", () => {
		const [only] = withCategoryDeltas([entry("a", 150)], [entry("a", 100)]);
		assert.equal(only.delta, 0.5);
	});

	it("signs a fall negative", () => {
		const [only] = withCategoryDeltas([entry("a", 50)], [entry("a", 100)]);
		assert.equal(only.delta, -0.5);
	});

	it("leaves a category with no prior spend null", () => {
		const [only] = withCategoryDeltas([entry("a", 50)], []);
		assert.equal(only.delta, null);
	});

	it("never divides by a zero prior amount", () => {
		const [only] = withCategoryDeltas([entry("a", 50)], [entry("a", 0)]);
		assert.equal(only.delta, null);
	});

	it("preserves every other field", () => {
		const source = entry("a", 150, 0.4);
		const [only] = withCategoryDeltas([source], [entry("a", 100)]);
		assert.equal(only.id, source.id);
		assert.equal(only.amount, source.amount);
		assert.equal(only.fraction, source.fraction);
	});
});

describe("categoryBreakdownWithin", () => {
	const meta = new Map<string, CategoryMeta>([
		[
			"food",
			{
				id: "food",
				name: "Food",
				color: "#AA0000",
				icon: null,
				emoji: null,
				income: false,
				parentId: null,
			},
		],
		[
			"taxi",
			{
				id: "taxi",
				name: "Taxi",
				color: "#0000AA",
				icon: null,
				emoji: null,
				income: false,
				parentId: null,
			},
		],
	]);

	const row = (
		categoryId: string,
		amount: number,
		date: Date,
	): InsightsContribution => ({
		amount,
		income: false,
		categoryId,
		parentId: null,
		date,
	});

	const now = new Date(2025, 6, 31, 12, 0, 0, 0);
	const rows = [
		row("food", 100, new Date(2025, 6, 10)),
		row("taxi", 40, new Date(2025, 6, 10)),
		row("food", 900, new Date(2025, 6, 20)),
	];

	it("counts only what falls inside the given bounds", () => {
		// Just the 10th — the bucket a user would have tapped.
		const bounds = {
			start: new Date(2025, 6, 10).getTime(),
			end: new Date(2025, 6, 11).getTime(),
		};
		const breakdown = categoryBreakdownWithin(rows, meta, "spent", bounds, now);
		const total = breakdown.reduce((sum, e) => sum + e.amount, 0);
		assert.equal(total, 140, "the 20th's 900 must not leak into the 10th");
	});

	it("recomputes shares against the narrowed total, not the window's", () => {
		const bounds = {
			start: new Date(2025, 6, 10).getTime(),
			end: new Date(2025, 6, 11).getTime(),
		};
		const breakdown = categoryBreakdownWithin(rows, meta, "spent", bounds, now);
		const food = breakdown.find((e) => e.id === "food");
		assert.ok(food);
		// 100 of 140 within the bucket, not 1000 of 1040 across the window.
		assert.ok(Math.abs(food.fraction - 100 / 140) < 1e-9);
	});

	it("never counts a future-dated row", () => {
		const future = [row("food", 500, new Date(2025, 7, 15))];
		const bounds = {
			start: new Date(2025, 6, 1).getTime(),
			end: new Date(2025, 8, 1).getTime(),
		};
		assert.deepEqual(
			categoryBreakdownWithin(future, meta, "spent", bounds, now),
			[],
		);
	});

	it("reads inflows for the income measure and ignores outflows", () => {
		const mixed: InsightsContribution[] = [
			{
				amount: 700,
				income: true,
				categoryId: "food",
				parentId: null,
				date: new Date(2025, 6, 10),
			},
			row("taxi", 40, new Date(2025, 6, 10)),
		];
		const bounds = {
			start: new Date(2025, 6, 1).getTime(),
			end: new Date(2025, 7, 1).getTime(),
		};
		const breakdown = categoryBreakdownWithin(
			mixed,
			meta,
			"income",
			bounds,
			now,
		);
		assert.equal(breakdown.length, 1);
		assert.equal(breakdown[0].amount, 700);
	});
});
