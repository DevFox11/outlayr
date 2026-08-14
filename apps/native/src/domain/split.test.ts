import { describe, expect, it } from "@jest/globals";

import { allocationsFor, isBalanced, rebalance, splitEvenly, totalsByCategory, unallocated } from "./split";
import type { Allocation } from "./split";

const entry = (id: string, amount: number, categoryId: string | null) => ({
    amount,
    categoryId,
    id,
});

describe("attributing an entry", () => {
    it("reads an unsplit entry as one allocation of its whole amount", () => {
        // This is what keeps every existing row, and every reader that never learns
        // about splitting, correct without being touched.
        expect(allocationsFor(entry("t1", 40, "food"), [])).toStrictEqual([{ amount: 40, categoryId: "food" }]);
    });

    it("carries a null category through rather than inventing one", () => {
        expect(allocationsFor(entry("t1", 40, null), [])).toStrictEqual([{ amount: 40, categoryId: null }]);
    });

    it("uses the explicit allocations when the entry has them", () => {
        const explicit: Allocation[] = [
            { amount: 25, categoryId: "food" },
            { amount: 15, categoryId: "travel" },
        ];
        expect(allocationsFor(entry("t1", 40, "food"), explicit)).toStrictEqual(explicit);
    });

    it("does not hand back the caller's own array to mutate", () => {
        const explicit: Allocation[] = [{ amount: 40, categoryId: "food" }];
        const result = allocationsFor(entry("t1", 40, "food"), explicit);
        result[0].amount = 999;
        expect(explicit[0].amount).toBe(40);
    });
});

describe("whether a split adds up", () => {
    it("accepts parts that sum to the entry", () => {
        expect(
            isBalanced(40, [
                { amount: 25, categoryId: "a" },
                { amount: 15, categoryId: "b" },
            ])
        ).toBe(true);
    });

    it("refuses parts that fall short", () => {
        // The row shows its own amount and the parts sit underneath it. A split
        // that does not add up is a visible contradiction, and every category
        // total downstream inherits it.
        expect(isBalanced(40, [{ amount: 25, categoryId: "a" }])).toBe(false);
    });

    it("refuses parts that overshoot", () => {
        expect(
            isBalanced(40, [
                { amount: 25, categoryId: "a" },
                { amount: 20, categoryId: "b" },
            ])
        ).toBe(false);
    });

    it("refuses an empty split", () => {
        expect(isBalanced(40, [])).toBe(false);
    });

    it("reports how far off a split is, with a sign", () => {
        expect(unallocated(40, [{ amount: 25, categoryId: "a" }])).toBe(15);
        expect(unallocated(40, [{ amount: 55, categoryId: "a" }])).toBe(-15);
    });
});

describe("splitting evenly", () => {
    it("adds up exactly when the total does not divide", () => {
        const parts = splitEvenly(10, 3);
        expect(parts.map((part) => part.amount)).toStrictEqual([3.34, 3.33, 3.33]);
        expect(isBalanced(10, parts)).toBe(true);
    });

    it("puts the remainder on the first part so it can be checked by eye", () => {
        expect(splitEvenly(10, 3)[0].amount).toBe(3.34);
    });

    it("divides cleanly when it divides", () => {
        const parts = splitEvenly(9, 3);
        expect(parts.map((part) => part.amount)).toStrictEqual([3, 3, 3]);
    });

    it("takes the categories it is given", () => {
        const parts = splitEvenly(10, 2, ["food", "travel"]);
        expect(parts.map((part) => part.categoryId)).toStrictEqual(["food", "travel"]);
    });

    it("answers nothing for a count below one", () => {
        expect(splitEvenly(10, 0)).toStrictEqual([]);
    });
});

describe("editing one part of a split", () => {
    const two: Allocation[] = [
        { amount: 25, categoryId: "a" },
        { amount: 15, categoryId: "b" },
    ];

    it("takes the difference out of another part so it stays balanced", () => {
        // Otherwise every keystroke leaves the entry unsaveable.
        const next = rebalance(40, two, 0, 30);
        expect(next.map((part) => part.amount)).toStrictEqual([30, 10]);
        expect(isBalanced(40, next)).toBe(true);
    });

    it("absorbs into an earlier part when the last one is being edited", () => {
        const next = rebalance(40, two, 1, 30);
        expect(next.map((part) => part.amount)).toStrictEqual([10, 30]);
        expect(isBalanced(40, next)).toBe(true);
    });

    it("refuses to make a part negative", () => {
        const next = rebalance(40, two, 0, -5);
        expect(next[0].amount).toBe(0);
    });

    it("leaves a lone part alone rather than balancing against nothing", () => {
        const one: Allocation[] = [{ amount: 40, categoryId: "a" }];
        expect(rebalance(40, one, 0, 25)).toStrictEqual([{ amount: 25, categoryId: "a" }]);
    });

    it("ignores an index that is not there", () => {
        expect(rebalance(40, two, 7, 10)).toStrictEqual(two);
    });
});

describe("totalling by category", () => {
    it("counts an unsplit entry exactly as it does today", () => {
        const totals = totalsByCategory([entry("t1", 40, "food")], new Map());
        expect(totals.get("food")).toBe(40);
    });

    it("spreads a split entry across its categories", () => {
        const totals = totalsByCategory(
            [entry("t1", 40, "food")],
            new Map([
                [
                    "t1",
                    [
                        { amount: 25, categoryId: "food" },
                        { amount: 15, categoryId: "travel" },
                    ],
                ],
            ])
        );
        expect(totals.get("food")).toBe(25);
        expect(totals.get("travel")).toBe(15);
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
                        { amount: 25, categoryId: "food" },
                        { amount: 15, categoryId: "travel" },
                    ],
                ],
            ])
        );
        const sum = [...totals.values()].reduce((a, b) => a + b, 0);
        expect(sum).toBe(50);
    });

    it("keeps uncategorised money under its own null key", () => {
        const totals = totalsByCategory([entry("t1", 40, null)], new Map());
        expect(totals.get(null)).toBe(40);
    });
});
