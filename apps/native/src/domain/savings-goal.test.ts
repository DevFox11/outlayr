import { describe, expect, it } from "@jest/globals";

import { goalProgress } from "./savings-goal";

const NOW = new Date("2026-08-13T12:00:00Z");

describe("where an account stands against its target", () => {
    it("reports the fraction saved", () => {
        const progress = goalProgress(1200, 5000);
        expect(progress.fraction).toBeCloseTo(0.24, 5);
        expect(progress.remaining).toBe(3800);
        expect(progress.reached).toBe(false);
    });

    it("is reached once the balance meets the target", () => {
        const progress = goalProgress(5000, 5000);
        expect(progress).toMatchObject({ fraction: 1, reached: true, remaining: 0 });
    });

    it("does not report over-saving as more than done", () => {
        const progress = goalProgress(7000, 5000);
        expect(progress.fraction).toBe(1);
        expect(progress.remaining).toBe(0);
    });

    it("reads an overdrawn account as no progress rather than negative", () => {
        const progress = goalProgress(-200, 5000);
        expect(progress.fraction).toBe(0);
        expect(progress.remaining).toBe(5000);
    });

    it("refuses a target of zero rather than dividing by it", () => {
        expect(goalProgress(100, 0)).toStrictEqual({ fraction: 0, pace: null, reached: false, remaining: 0 });
    });
});

describe("the pace a target demands", () => {
    it("says what to set aside each month", () => {
        const progress = goalProgress(1000, 4000, {
            now: NOW,
            targetDate: new Date("2026-12-13T12:00:00Z"),
        });
        expect(progress.pace?.monthsLeft).toBe(4);
        expect(progress.pace?.perMonth).toBe(750);
    });

    it("has no pace without a target date, because nothing is being asked by when", () => {
        expect(goalProgress(1000, 4000, { now: NOW }).pace).toBeNull();
    });

    it("has no pace once the goal is reached", () => {
        const progress = goalProgress(4000, 4000, {
            now: NOW,
            targetDate: new Date("2026-12-13T12:00:00Z"),
        });
        expect(progress.pace).toBeNull();
    });

    it("asks for the whole remainder on the target date rather than dividing by zero", () => {
        const progress = goalProgress(1000, 4000, { now: NOW, targetDate: NOW });
        expect(progress.pace).toStrictEqual({ monthsLeft: 0, perMonth: 3000 });
    });

    it("asks for the whole remainder once the date has passed", () => {
        const progress = goalProgress(1000, 4000, {
            now: NOW,
            targetDate: new Date("2026-01-01T12:00:00Z"),
        });
        expect(progress.pace).toStrictEqual({ monthsLeft: 0, perMonth: 3000 });
        expect(Number.isFinite(progress.pace?.perMonth ?? 0)).toBe(true);
    });
});
