import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type BudgetSeverity, compareBudgetSeverity } from "./budget-severity";

function budget(
	amount: number,
	spent: number,
	name = `${amount}/${spent}`,
): BudgetSeverity & { name: string } {
	return { amount, spent, overBudget: spent > amount, name };
}

function rank(list: (BudgetSeverity & { name: string })[]): string[] {
	return [...list].sort(compareBudgetSeverity).map((b) => b.name);
}

describe("compareBudgetSeverity", () => {
	it("puts every over-budget budget ahead of every healthy one", () => {
		const nearlyGone = budget(500, 499, "nearly-gone");
		const barelyOver = budget(500, 501, "barely-over");
		assert.equal(compareBudgetSeverity(barelyOver, nearlyGone) < 0, true);
		assert.equal(compareBudgetSeverity(nearlyGone, barelyOver) > 0, true);
	});

	it("orders over-budget budgets by absolute overage, not by percent", () => {
		// 150% of a small limit is a smaller hole than 110% of a large one, and the
		// hole is what has to be covered.
		const small = budget(100, 150, "small-loud");
		const large = budget(2000, 2200, "large-deep");
		assert.deepEqual(rank([small, large]), ["large-deep", "small-loud"]);
	});

	it("orders healthy budgets by percent spent, deepest first", () => {
		const list = [
			budget(1000, 100, "10pct"),
			budget(200, 180, "90pct"),
			budget(500, 250, "50pct"),
		];
		assert.deepEqual(rank(list), ["90pct", "50pct", "10pct"]);
	});

	it("keeps the incoming order when severity ties", () => {
		const first = budget(400, 200, "first");
		const second = budget(800, 400, "second");
		assert.equal(compareBudgetSeverity(first, second), 0);
		assert.deepEqual(rank([first, second]), ["first", "second"]);
		assert.deepEqual(rank([second, first]), ["second", "first"]);
	});

	it("treats an untouched zero-limit budget as the least severe healthy one", () => {
		const zero = budget(0, 0, "zero");
		const spent = budget(1000, 1, "barely-spent");
		assert.deepEqual(rank([zero, spent]), ["barely-spent", "zero"]);
	});

	it("ranks a zero-limit budget with spending among the over-budget group", () => {
		const zero = budget(0, 40, "zero-limit-spent");
		const healthy = budget(1000, 999, "healthy");
		const deeper = budget(1000, 1100, "deeper");
		assert.deepEqual(rank([healthy, zero, deeper]), [
			"deeper",
			"zero-limit-spent",
			"healthy",
		]);
	});

	it("sorts a mixed list worst-first in one pass", () => {
		const list = [
			budget(500, 100, "under-20"),
			budget(300, 600, "over-300"),
			budget(900, 800, "under-89"),
			budget(1000, 1050, "over-50"),
		];
		assert.deepEqual(rank(list), [
			"over-300",
			"over-50",
			"under-89",
			"under-20",
		]);
	});
});
