import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type Allocation,
	allocationsFor,
	isBalanced,
	rebalance,
	splitEvenly,
	totalsByCategory,
	unallocated,
} from "./split";

const entry = (id: string, amount: number, categoryId: string | null) => ({
	id,
	amount,
	categoryId,
});

describe("attributing an entry", () => {
	it("reads an unsplit entry as one allocation of its whole amount", () => {
		// This is what keeps every existing row, and every reader that never learns
		// about splitting, correct without being touched.
		assert.deepEqual(allocationsFor(entry("t1", 40, "food"), []), [
			{ categoryId: "food", amount: 40 },
		]);
	});

	it("carries a null category through rather than inventing one", () => {
		assert.deepEqual(allocationsFor(entry("t1", 40, null), []), [
			{ categoryId: null, amount: 40 },
		]);
	});

	it("uses the explicit allocations when the entry has them", () => {
		const explicit: Allocation[] = [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		];
		assert.deepEqual(
			allocationsFor(entry("t1", 40, "food"), explicit),
			explicit,
		);
	});

	it("does not hand back the caller's own array to mutate", () => {
		const explicit: Allocation[] = [{ categoryId: "food", amount: 40 }];
		const result = allocationsFor(entry("t1", 40, "food"), explicit);
		result[0].amount = 999;
		assert.equal(explicit[0].amount, 40);
	});
});

describe("whether a split adds up", () => {
	it("accepts parts that sum to the entry", () => {
		assert.equal(
			isBalanced(40, [
				{ categoryId: "a", amount: 25 },
				{ categoryId: "b", amount: 15 },
			]),
			true,
		);
	});

	it("refuses parts that fall short", () => {
		// The row shows its own amount and the parts sit underneath it. A split
		// that does not add up is a visible contradiction, and every category
		// total downstream inherits it.
		assert.equal(isBalanced(40, [{ categoryId: "a", amount: 25 }]), false);
	});

	it("refuses parts that overshoot", () => {
		assert.equal(
			isBalanced(40, [
				{ categoryId: "a", amount: 25 },
				{ categoryId: "b", amount: 20 },
			]),
			false,
		);
	});

	it("refuses an empty split", () => {
		assert.equal(isBalanced(40, []), false);
	});

	it("reports how far off a split is, with a sign", () => {
		assert.equal(unallocated(40, [{ categoryId: "a", amount: 25 }]), 15);
		assert.equal(unallocated(40, [{ categoryId: "a", amount: 55 }]), -15);
	});
});

describe("splitting evenly", () => {
	it("adds up exactly when the total does not divide", () => {
		const parts = splitEvenly(10, 3);
		assert.deepEqual(
			parts.map((part) => part.amount),
			[3.34, 3.33, 3.33],
		);
		assert.equal(isBalanced(10, parts), true);
	});

	it("puts the remainder on the first part so it can be checked by eye", () => {
		assert.equal(splitEvenly(10, 3)[0].amount, 3.34);
	});

	it("divides cleanly when it divides", () => {
		const parts = splitEvenly(9, 3);
		assert.deepEqual(
			parts.map((part) => part.amount),
			[3, 3, 3],
		);
	});

	it("takes the categories it is given", () => {
		const parts = splitEvenly(10, 2, ["food", "travel"]);
		assert.deepEqual(
			parts.map((part) => part.categoryId),
			["food", "travel"],
		);
	});

	it("answers nothing for a count below one", () => {
		assert.deepEqual(splitEvenly(10, 0), []);
	});
});

describe("editing one part of a split", () => {
	const two: Allocation[] = [
		{ categoryId: "a", amount: 25 },
		{ categoryId: "b", amount: 15 },
	];

	it("takes the difference out of another part so it stays balanced", () => {
		// Otherwise every keystroke leaves the entry unsaveable.
		const next = rebalance(40, two, 0, 30);
		assert.deepEqual(
			next.map((part) => part.amount),
			[30, 10],
		);
		assert.equal(isBalanced(40, next), true);
	});

	it("absorbs into an earlier part when the last one is being edited", () => {
		const next = rebalance(40, two, 1, 30);
		assert.deepEqual(
			next.map((part) => part.amount),
			[10, 30],
		);
		assert.equal(isBalanced(40, next), true);
	});

	it("refuses to make a part negative", () => {
		const next = rebalance(40, two, 0, -5);
		assert.equal(next[0].amount, 0);
	});

	it("leaves a lone part alone rather than balancing against nothing", () => {
		const one: Allocation[] = [{ categoryId: "a", amount: 40 }];
		assert.deepEqual(rebalance(40, one, 0, 25), [
			{ categoryId: "a", amount: 25 },
		]);
	});

	it("ignores an index that is not there", () => {
		assert.deepEqual(rebalance(40, two, 7, 10), two);
	});
});

describe("totalling by category", () => {
	it("counts an unsplit entry exactly as it does today", () => {
		const totals = totalsByCategory([entry("t1", 40, "food")], new Map());
		assert.equal(totals.get("food"), 40);
	});

	it("spreads a split entry across its categories", () => {
		const totals = totalsByCategory(
			[entry("t1", 40, "food")],
			new Map([
				[
					"t1",
					[
						{ categoryId: "food", amount: 25 },
						{ categoryId: "travel", amount: 15 },
					],
				],
			]),
		);
		assert.equal(totals.get("food"), 25);
		assert.equal(totals.get("travel"), 15);
	});

	it("never counts a split entry twice", () => {
		// The whole risk of the feature: a category breakdown that sums to more
		// than the ledger.
		const totals = totalsByCategory(
			[entry("t1", 40, "food"), entry("t2", 10, "travel")],
			new Map([
				[
					"t1",
					[
						{ categoryId: "food", amount: 25 },
						{ categoryId: "travel", amount: 15 },
					],
				],
			]),
		);
		const sum = [...totals.values()].reduce((a, b) => a + b, 0);
		assert.equal(sum, 50);
	});

	it("keeps uncategorised money under its own null key", () => {
		const totals = totalsByCategory([entry("t1", 40, null)], new Map());
		assert.equal(totals.get(null), 40);
	});
});
