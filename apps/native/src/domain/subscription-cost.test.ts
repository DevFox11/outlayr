import { describe, expect, it } from "@jest/globals";

import { RECURRING_TYPE } from "./recurrence";
import { monthlyChargeCount, monthlyEquivalent, monthlySubscriptionCost } from "./subscription-cost";
import type { ScheduleCostEntry } from "./subscription-cost";
import { buildRateTable } from "./valuation";

const DAYS_PER_MONTH = 365 / 12;
const WEEKS_PER_MONTH = 52 / 12;

function isClose(actual: number, expected: number) {
    return Math.abs(actual - expected) < 1e-9;
}

function schedule(
    amount: number,
    recurringType: number,
    recurringCoefficient = 1,
    extra: Partial<ScheduleCostEntry> = {}
): ScheduleCostEntry {
    return {
        amount,
        currency: "USD",
        income: false,
        recurringCoefficient,
        recurringType,
        ...extra,
    };
}

describe("normalizing one schedule to a month", () => {
    it("restates every cadence at its own rate", () => {
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.daily, 1), 30 * DAYS_PER_MONTH)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.weekly, 1), 30 * WEEKS_PER_MONTH)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.monthly, 1), 30)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.yearly, 1), 2.5)).toBeTruthy();
    });

    it("divides by the interval when the schedule skips periods", () => {
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.daily, 2), (30 * DAYS_PER_MONTH) / 2)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.weekly, 3), (30 * WEEKS_PER_MONTH) / 3)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.monthly, 4), 7.5)).toBeTruthy();
        expect(isClose(monthlyEquivalent(30, RECURRING_TYPE.yearly, 2), 1.25)).toBeTruthy();
    });

    it("charges a non-recurring row nothing at all", () => {
        expect(monthlyChargeCount(RECURRING_TYPE.none, 1)).toBe(0);
        expect(monthlyEquivalent(999, RECURRING_TYPE.none, 1)).toBe(0);
    });

    it("reads a coefficient below one as every period, matching nextDate", () => {
        expect(monthlyChargeCount(RECURRING_TYPE.monthly, 0)).toBe(1);
        expect(monthlyChargeCount(RECURRING_TYPE.monthly, -3)).toBe(1);
        expect(
            isClose(monthlyChargeCount(RECURRING_TYPE.daily, 0.4), monthlyChargeCount(RECURRING_TYPE.daily, 1))
        ).toBeTruthy();
    });
});

describe("monthlySubscriptionCost", () => {
    it("weighs a daily coffee far above a yearly renewal that costs more per charge", () => {
        // The defect this fixes: at face value the $12 renewal outweighs the $5
        // coffee, because each contributes exactly one charge to the list.
        const coffee = schedule(5, RECURRING_TYPE.daily);
        const renewal = schedule(12, RECURRING_TYPE.yearly);

        const [coffeeOnly] = monthlySubscriptionCost([coffee], "USD");
        const [renewalOnly] = monthlySubscriptionCost([renewal], "USD");
        expect(isClose(coffeeOnly.amount, -(5 * DAYS_PER_MONTH))).toBeTruthy();
        expect(isClose(renewalOnly.amount, -1)).toBeTruthy();
        expect(Math.abs(coffeeOnly.amount) > Math.abs(renewalOnly.amount) * 100).toBeTruthy();

        const [both] = monthlySubscriptionCost([coffee, renewal], "USD");
        expect(isClose(both.amount, -(5 * DAYS_PER_MONTH + 1))).toBeTruthy();
        expect(both.transactionCount).toBe(2);
    });

    it("drops a retired schedule instead of counting it", () => {
        const buckets = monthlySubscriptionCost(
            [schedule(20, RECURRING_TYPE.monthly), schedule(999, RECURRING_TYPE.none)],
            "USD"
        );
        expect(buckets).toHaveLength(1);
        expect(buckets[0].amount).toBe(-20);
        expect(buckets[0].transactionCount).toBe(1);
    });

    it("lets a retired row open no bucket of its own", () => {
        const buckets = monthlySubscriptionCost(
            [schedule(20, RECURRING_TYPE.monthly), schedule(999, RECURRING_TYPE.none, 1, { currency: "EUR" })],
            "USD"
        );
        expect(buckets).toStrictEqual([{ amount: -20, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("still answers with a zero bucket when nothing recurs", () => {
        expect(monthlySubscriptionCost([schedule(999, RECURRING_TYPE.none)], "USD")).toStrictEqual([
            { amount: 0, currencyCode: "USD", transactionCount: 0 },
        ]);
    });

    it("keeps each currency in its own figure rather than adding them", () => {
        const buckets = monthlySubscriptionCost(
            [schedule(10, RECURRING_TYPE.monthly), schedule(240, RECURRING_TYPE.yearly, 1, { currency: "EUR" })],
            "USD"
        );
        expect(buckets).toHaveLength(2);
        expect(buckets.map((bucket) => [bucket.currencyCode, bucket.amount])).toStrictEqual([
            ["USD", -10],
            ["EUR", -20],
        ]);
    });

    it("offsets a recurring income against the schedules it pays for", () => {
        const [bucket] = monthlySubscriptionCost(
            [schedule(10, RECURRING_TYPE.monthly), schedule(3000, RECURRING_TYPE.monthly, 1, { income: true })],
            "USD"
        );
        expect(bucket.amount).toBe(2990);
    });

    it("drops a schedule whose end date has passed", () => {
        // Otherwise the figure keeps charging the owner for a commitment they
        // already ended, every month, forever.
        const now = new Date(Date.UTC(2026, 6, 20));
        const buckets = monthlySubscriptionCost(
            [
                schedule(1000, RECURRING_TYPE.monthly, 1, {
                    recurringEndDate: new Date(Date.UTC(2026, 5, 30)),
                }),
                schedule(500, RECURRING_TYPE.monthly),
            ],
            "USD",
            undefined,
            now
        );
        expect(buckets).toStrictEqual([{ amount: -500, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("keeps a schedule whose end date is still ahead", () => {
        const now = new Date(Date.UTC(2026, 6, 20));
        const buckets = monthlySubscriptionCost(
            [
                schedule(1000, RECURRING_TYPE.monthly, 1, {
                    recurringEndDate: new Date(Date.UTC(2026, 8, 30)),
                }),
            ],
            "USD",
            undefined,
            now
        );
        expect(buckets).toStrictEqual([{ amount: -1000, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("keeps a schedule that names no end at all", () => {
        const buckets = monthlySubscriptionCost(
            [schedule(1000, RECURRING_TYPE.monthly)],
            "USD",
            undefined,
            new Date(Date.UTC(2026, 6, 20))
        );
        expect(buckets).toStrictEqual([{ amount: -1000, currencyCode: "USD", transactionCount: 1 }]);
    });

    it("converts the month's figure, not the single charge, at the day's rate", () => {
        // $1200/year is $100/month, which is €90 at the 5th's rate. Converting the
        // $1200 first would print €1080 and then divide to €90 only by luck — a
        // schedule whose rate moved between charges would not land there.
        const rates = buildRateTable([{ date: "2026-07-01", quote: "EUR", rate: 0.9 }]);
        const buckets = monthlySubscriptionCost(
            [
                schedule(1200, RECURRING_TYPE.yearly, 1, {
                    amountUsd: 1200,
                    date: new Date(Date.UTC(2026, 6, 5, 12)),
                }),
            ],
            "EUR",
            rates
        );
        expect(buckets).toStrictEqual([{ amount: -90, currencyCode: "EUR", transactionCount: 1 }]);
    });
});
