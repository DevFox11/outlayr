import { describe, expect, it } from "@jest/globals";

import { isBalanced, unallocated } from "./split";
import { addPart, isRealSplit, openDraft, removePart, setPartAmount, setPartCategory } from "./split-draft";

const TOTAL = 84;

describe("opening a split", () => {
    it("starts as the entry already reads: one part holding everything", () => {
        expect(openDraft(TOTAL, "groceries")).toStrictEqual([{ amount: 84, categoryId: "groceries" }]);
    });

    it("is not yet a split, because one part says what the entry already says", () => {
        expect(isRealSplit(openDraft(TOTAL, "groceries"))).toBe(false);
    });
});

describe("adding a category", () => {
    it("leaves the amounts already typed alone", () => {
        const draft = addPart(openDraft(TOTAL, "groceries"), "home");
        expect(draft).toStrictEqual([
            { amount: 84, categoryId: "groceries" },
            { amount: 0, categoryId: "home" },
        ]);
    });

    it("keeps the draft balanced, so adding never makes it unsaveable", () => {
        const draft = addPart(openDraft(TOTAL, "groceries"), "home");
        expect(isBalanced(TOTAL, draft)).toBe(true);
    });

    it("counts as a split once there are two parts", () => {
        expect(isRealSplit(addPart(openDraft(TOTAL, "groceries"), "home"))).toBe(true);
    });
});

describe("typing an amount", () => {
    it("moves the difference out of a neighbour rather than leaving a remainder", () => {
        const draft = setPartAmount(TOTAL, addPart(openDraft(TOTAL, "groceries"), "home"), 1, 34);
        expect(draft).toStrictEqual([
            { amount: 50, categoryId: "groceries" },
            { amount: 34, categoryId: "home" },
        ]);
        expect(unallocated(TOTAL, draft)).toBe(0);
    });

    it("stays balanced across three parts, added and filled in turn", () => {
        let draft = addPart(openDraft(TOTAL, "groceries"), "home");
        draft = setPartAmount(TOTAL, draft, 1, 34);
        draft = addPart(draft, "pets");
        draft = setPartAmount(TOTAL, draft, 2, 10);
        expect(isBalanced(TOTAL, draft)).toBe(true);
        expect(draft.map((one) => one.amount)).toStrictEqual([50, 24, 10]);
    });

    it("never shows a negative part when there is nothing left to take from", () => {
        // Both categories added before anything was typed, so the draft is 84/0/0
        // and filling the middle one has no slack to absorb it.
        let draft = addPart(addPart(openDraft(TOTAL, "groceries"), "home"), "pets");
        draft = setPartAmount(TOTAL, draft, 1, 24);

        expect(draft.every((one) => one.amount >= 0)).toBe(true);
        // Honest about the consequence rather than hiding it in a negative.
        expect(isBalanced(TOTAL, draft)).toBe(false);
        expect(unallocated(TOTAL, draft)).toBe(-24);
    });
});

describe("removing a category", () => {
    it("hands the freed amount to the last part left, so the draft stays saveable", () => {
        let draft = addPart(openDraft(TOTAL, "groceries"), "home");
        draft = setPartAmount(TOTAL, draft, 1, 34);
        draft = addPart(draft, "pets");
        draft = setPartAmount(TOTAL, draft, 2, 10);

        const without = removePart(draft, 1);
        expect(without).toStrictEqual([
            { amount: 50, categoryId: "groceries" },
            { amount: 34, categoryId: "pets" },
        ]);
        expect(isBalanced(TOTAL, without)).toBe(true);
    });

    it("stops being a split when it is back to one part", () => {
        const draft = addPart(openDraft(TOTAL, "groceries"), "home");
        expect(isRealSplit(removePart(draft, 1))).toBe(false);
    });

    it("ignores an index that is not there", () => {
        const draft = openDraft(TOTAL, "groceries");
        expect(removePart(draft, 4)).toStrictEqual(draft);
    });
});

describe("changing a part's category", () => {
    it("leaves every amount where it was", () => {
        const draft = setPartAmount(TOTAL, addPart(openDraft(TOTAL, "groceries"), "home"), 1, 34);
        expect(setPartCategory(draft, 1, "pets")).toStrictEqual([
            { amount: 50, categoryId: "groceries" },
            { amount: 34, categoryId: "pets" },
        ]);
    });
});

describe("when the entry's own amount changes under a split", () => {
    it("goes unbalanced, which is the state the save has to refuse", () => {
        const draft = setPartAmount(TOTAL, addPart(openDraft(TOTAL, "groceries"), "home"), 1, 34);
        // The user goes back and makes it $100.
        expect(isBalanced(100, draft)).toBe(false);
        expect(unallocated(100, draft)).toBe(16);
    });
});
