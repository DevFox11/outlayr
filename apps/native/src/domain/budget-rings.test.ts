import { describe, expect, it } from "@jest/globals";

import type { CategoryBudgetView } from "@/data/budgets";

import { budgetRingData } from "./budget-rings";

function budget(
    id: string,
    amount: number,
    spent: number,
    overrides: Partial<CategoryBudgetView> = {}
): CategoryBudgetView {
    return {
        amount,
        anchor: new Date(2026, 0, 1),
        carry: 0,
        categoryId: `category-${id}`,
        color: `#00000${id}`,
        currency: null,
        customName: null,
        emoji: null,
        icon: null,
        id,
        leftover: amount - spent,
        limit: amount,
        name: `Budget ${id}`,
        overBudget: spent > amount,
        rollover: false,
        spent,
        type: 2,
        window: {
            end: new Date("2026-09-01T00:00:00Z"),
            start: new Date("2026-08-01T00:00:00Z"),
        },
        ...overrides,
    };
}

describe("budgetRingData", () => {
    it("preserves severity order and limits the result to four rings", () => {
        const result = budgetRingData([
            budget("1", 100, 125),
            budget("2", 100, 95),
            budget("3", 100, 80),
            budget("4", 100, 60),
            budget("5", 100, 40),
        ]);

        expect(result.map(({ id }) => id)).toStrictEqual(["1", "2", "3", "4"]);
    });

    it("filters non-positive targets before applying the four-ring cap", () => {
        const result = budgetRingData([
            budget("zero", 0, 10),
            budget("negative", -10, 0),
            budget("1", 100, 90),
            budget("2", 100, 80),
            budget("3", 100, 70),
            budget("4", 100, 60),
            budget("5", 100, 50),
        ]);

        expect(result.map(({ id }) => id)).toStrictEqual(["1", "2", "3", "4"]);
    });

    it("represents zero spend as zero progress", () => {
        expect(budgetRingData([budget("1", 250, 0)])).toStrictEqual([
            expect.objectContaining({ maxValue: 250, percent: 0, value: 0 }),
        ]);
    });

    it("keeps the uncapped percentage for an over-budget category", () => {
        expect(budgetRingData([budget("1", 100, 175)])[0]).toStrictEqual(
            expect.objectContaining({ maxValue: 100, percent: 175, value: 175 })
        );
    });
});
