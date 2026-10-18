import { describe, expect, it } from "@jest/globals";

import { groupByDay } from "./day-sections";

const DAY = new Date(2026, 7, 9);

function row(amount: number, income: boolean, extra: Record<string, unknown> = {}) {
    return { amount, currency: "USD", date: DAY, day: DAY, income, ...extra };
}

describe("a transfer sits in the day's list without touching its total", () => {
    it("leaves the total to the real entries around it", () => {
        const [section] = groupByDay(
            [row(6.4, false), row(100, false, { excludedFromTotals: true }), row(40, false)],
            "USD"
        );

        expect(section.total).toBe(-46.4);
    });

    it("still lists the transfer among the day's rows", () => {
        const [section] = groupByDay([row(6.4, false), row(100, false, { excludedFromTotals: true })], "USD");

        expect(section.data).toHaveLength(2);
    });

    it("reports a zero total for a day that holds nothing but transfers", () => {
        const [section] = groupByDay([row(100, false, { excludedFromTotals: true })], "USD");

        expect(section.total).toBe(0);
        expect(section.data).toHaveLength(1);
    });

    it("folds a fee under its transfer instead of listing it as its own row", () => {
        const transfer = row(100, false, { excludedFromTotals: true, id: "t1", transferId: "t1" });
        const fee = row(2.7, false, { id: "fee", transferId: "t1" });
        const [section] = groupByDay([transfer, fee], "USD");

        expect(section.data).toStrictEqual([{ ...transfer, fee }]);
        expect(section.total).toBe(-2.7);
    });
});
