import { describe, expect, it } from "@jest/globals";

import { reminderCopy } from "./subscription-reminder-copy";

const PRIME = {
    account: "Payoneer USD",
    amount: 7.06,
    category: "Streaming",
    currency: "USD",
    fireAt: new Date(2026, 9, 8, 8, 0),
    income: false,
    landing: new Date(2026, 9, 9),
    note: "Prime Video",
};

describe("reminderCopy", () => {
    it("leads with the amount and name, then when, category and account", () => {
        expect(reminderCopy(PRIME, "en")).toStrictEqual({
            body: "Tomorrow · Streaming · Payoneer USD",
            title: "$7.06 · Prime Video",
        });
        expect(reminderCopy(PRIME, "es").body).toBe("Mañana · Streaming · Payoneer USD");
    });

    it("signs a repeating income and drops a missing account", () => {
        expect(
            reminderCopy(
                { ...PRIME, account: null, amount: 2400, category: "Salary", income: true, note: "Salary" },
                "en"
            )
        ).toStrictEqual({ body: "Tomorrow", title: "+$2,400.00 · Salary" });
    });

    it("drops a category that only repeats the name, whatever its case", () => {
        expect(reminderCopy({ ...PRIME, category: " prime VIDEO " }, "en").body).toBe("Tomorrow · Payoneer USD");
    });

    it("names an untitled charge after its category without repeating it", () => {
        expect(reminderCopy({ ...PRIME, note: "  " }, "en")).toStrictEqual({
            body: "Tomorrow · Payoneer USD",
            title: "$7.06 · Streaming",
        });
    });

    it("falls back to the generic name with neither a note nor a category", () => {
        expect(reminderCopy({ ...PRIME, category: null, note: "" }, "en").title).toBe("$7.06 · Subscription");
    });
});
