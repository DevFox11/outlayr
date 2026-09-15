import { describe, expect, it } from "@jest/globals";

import { goalProgress, goalRequiredLine } from "./savings-goal";

const NOW = new Date("2026-08-13T12:00:00Z");

/**
 * A 100-day goal, 60 days elapsed at NOW, opened on an account holding nothing —
 * so the line the date demands sits at exactly three fifths of the way up.
 */
const SPAN = {
    now: NOW,
    startAmount: 0,
    startDate: new Date("2026-06-14T12:00:00Z"),
    targetDate: new Date("2026-09-22T12:00:00Z"),
};

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
        expect(goalProgress(100, 0)).toStrictEqual({
            fraction: 0,
            pace: null,
            reached: false,
            remaining: 0,
            standing: null,
        });
    });
});

describe("the pace a target demands", () => {
    it("says what to set aside each month", () => {
        const progress = goalProgress(1000, 4000, { ...SPAN, targetDate: new Date("2026-12-13T12:00:00Z") });
        expect(progress.pace?.monthsLeft).toBe(4);
        expect(progress.pace?.perMonth).toBe(750);
    });

    it("has no pace once the goal is reached", () => {
        expect(goalProgress(4000, 4000, SPAN).pace).toBeNull();
    });

    it("asks for the whole remainder on the target date rather than dividing by zero", () => {
        const progress = goalProgress(1000, 4000, { ...SPAN, targetDate: NOW });
        expect(progress.pace).toStrictEqual({ monthsLeft: 0, perMonth: 3000 });
    });

    it("asks for the whole remainder once the date has passed", () => {
        const progress = goalProgress(1000, 4000, { ...SPAN, targetDate: new Date("2026-08-01T12:00:00Z") });
        expect(progress.pace).toStrictEqual({ monthsLeft: 0, perMonth: 3000 });
        expect(Number.isFinite(progress.pace?.perMonth ?? 0)).toBe(true);
    });
});

describe("standing against the line the date demands", () => {
    it("is ahead when the balance beats the elapsed share of the target", () => {
        // Three fifths elapsed on a 0 → 4000 line wants 2400 held.
        const progress = goalProgress(3000, 4000, SPAN);
        expect(progress.standing?.expected).toBe(2400);
        expect(progress.standing?.against).toBe(600);
    });

    it("is behind when it does not", () => {
        const progress = goalProgress(1000, 4000, SPAN);
        expect(progress.standing?.against).toBe(-1400);
    });

    it("measures from the balance the account already held, not from zero", () => {
        // Opening at 1000 on a 1000 → 4000 line wants 2800 held at three fifths.
        const progress = goalProgress(2800, 4000, { ...SPAN, startAmount: 1000 });
        expect(progress.standing?.expected).toBe(2800);
        expect(progress.standing?.against).toBe(0);
    });

    it("calls a sliver either side of the line on pace, not a shortfall", () => {
        // A goal set moments ago has already drifted a cent off its own line. The
        // gap is real and it is noise.
        const justSet = goalProgress(2140, 6000, {
            now: new Date("2026-06-14T12:00:01Z"),
            startAmount: 2140,
            startDate: new Date("2026-06-14T12:00:00Z"),
            targetDate: new Date("2026-12-14T12:00:00Z"),
        });
        expect(justSet.standing?.onPace).toBe(true);
        expect(Math.abs(justSet.standing?.against ?? 99)).toBeLessThan(1);
    });

    it("still calls a goal set yesterday on pace, having had no day to save in", () => {
        // The line advances in whole days, so a fresh goal is exactly one day off
        // it the first time midnight passes. That is the commonest state a new goal
        // is in, and the band tolerates a full day rather than less than one.
        const oneDayOff = goalProgress(2360, 4000, SPAN);
        expect(oneDayOff.standing?.against).toBe(-40);
        expect(oneDayOff.standing?.onPace).toBe(true);
    });

    it("holds the band at a day of what the goal demands, not a fixed unit", () => {
        // SPAN climbs 4000 over 100 days, so a day of the line is 40. The clock
        // moves this gap on its own; only a real shortfall should read as one.
        const withinADay = goalProgress(2361, 4000, SPAN);
        expect(withinADay.standing?.against).toBe(-39);
        expect(withinADay.standing?.onPace).toBe(true);

        const beyond = goalProgress(2359, 4000, SPAN);
        expect(beyond.standing?.against).toBe(-41);
        expect(beyond.standing?.onPace).toBe(false);
    });

    it("floors the band at one unit, so a tiny goal is not given a sub-cent one", () => {
        // A 100-day span climbing 10 asks 0.1 a day, and wants 6 held at three
        // fifths. Being 0.5 off is ten days of that line and still inside the floor.
        const progress = goalProgress(6.5, 10, { ...SPAN, startAmount: 0 });
        expect(progress.standing?.against).toBe(0.5);
        expect(progress.standing?.onPace).toBe(true);
    });

    it("has no standing once reached, because there is no line left to be behind", () => {
        expect(goalProgress(4000, 4000, SPAN).standing).toBeNull();
    });

    it("refuses a span that starts on its own target date rather than dividing by it", () => {
        expect(goalProgress(1000, 4000, { ...SPAN, startDate: NOW, targetDate: NOW }).standing).toBeNull();
    });

    it("holds the line at the target once the date has passed", () => {
        const progress = goalProgress(1000, 4000, { ...SPAN, now: new Date("2027-06-01T12:00:00Z") });
        expect(progress.standing?.elapsed).toBe(1);
        expect(progress.standing?.expected).toBe(4000);
    });
});

describe("the clock the standing is read on", () => {
    it("does not drift through the day, since nothing tells the app the hour changed", () => {
        // `useNow` publishes at midnight, on a ledger write and on resume. A
        // standing measured at instant granularity would be right only at the
        // moment it was computed and stale for as long as the screen stayed open.
        const morning = goalProgress(2000, 4000, { ...SPAN, now: new Date("2026-08-13T06:00:00Z") });
        const evening = goalProgress(2000, 4000, { ...SPAN, now: new Date("2026-08-13T22:00:00Z") });

        expect(morning.standing).toStrictEqual(evening.standing);
    });

    it("advances when the day does", () => {
        const today = goalProgress(2000, 4000, SPAN);
        const tomorrow = goalProgress(2000, 4000, { ...SPAN, now: new Date("2026-08-14T12:00:00Z") });

        expect(tomorrow.standing?.expected).toBeGreaterThan(today.standing?.expected ?? 0);
    });
});

describe("a goal opened on an account in the red", () => {
    it("does not read the debt's own size as a lead", () => {
        // `held` is clamped to zero, so the anchor has to be too. Left at -1000 the
        // line would start a thousand below the balance above it and report the
        // overdraft as an immediate $1,000 head start.
        const progress = goalProgress(-1000, 4000, { ...SPAN, startAmount: -1000 });
        expect(progress.standing?.expected).toBe(2400);
        expect(progress.standing?.against).toBe(-2400);
    });

    it("sizes its on-pace band from the line it actually draws", () => {
        // 0 → 4000 over 100 days climbs 40 a day. Measured against the raw -1000
        // span the band would be 50, and a balance a day and a bit behind would
        // still read as on pace.
        const progress = goalProgress(2355, 4000, { ...SPAN, startAmount: -1000 });
        expect(progress.standing?.against).toBe(-45);
        expect(progress.standing?.onPace).toBe(false);
    });

    it("draws its required line from the same anchor the standing uses", () => {
        const line = goalRequiredLine(
            { startAmount: -1000, startDate: SPAN.startDate, targetDate: SPAN.targetDate },
            4000
        );
        expect(line.at(0)?.value).toBe(0);
    });
});

describe("the calendar a goal is measured on", () => {
    it("keeps a one-day goal measurable wherever the reader is", () => {
        // The picker hands back a local midnight, and east of UTC that belongs to
        // the previous UTC date — so truncating to UTC days could land both ends of
        // a made-today, due-tomorrow goal on one day and leave it with no standing
        // at all. Built through the local constructor, as the picker would.
        const opened = new Date(2026, 7, 13, 0, 0, 0);
        const due = new Date(2026, 7, 14, 0, 0, 0);
        const progress = goalProgress(0, 100, { now: opened, startAmount: 0, startDate: opened, targetDate: due });

        expect(progress.standing).not.toBeNull();
        expect(progress.standing?.elapsed).toBe(0);
    });

    it("advances on the reader's midnight, not the epoch's", () => {
        const opened = new Date(2026, 7, 13, 0, 0, 0);
        const due = new Date(2026, 7, 23, 0, 0, 0);
        const span = { startAmount: 0, startDate: opened, targetDate: due };

        const lateToday = goalProgress(0, 100, { ...span, now: new Date(2026, 7, 13, 23, 59) });
        const earlyTomorrow = goalProgress(0, 100, { ...span, now: new Date(2026, 7, 14, 0, 1) });

        expect(lateToday.standing?.elapsed).toBe(0);
        expect(earlyTomorrow.standing?.elapsed).toBeCloseTo(0.1, 10);
    });
});

describe("a goal spanning a clock change", () => {
    it("counts calendar days, not the hours between midnights", () => {
        // Spring forward: 7 March to 9 March is 47 hours in a shifting zone, so
        // dividing the raw span would report the 8th as 24/47 elapsed rather than
        // as one day of two. Built through the local constructor so the zone's own
        // rules apply wherever this runs.
        const opened = new Date(2027, 2, 7);
        const due = new Date(2027, 2, 9);
        const progress = goalProgress(0, 100, {
            now: new Date(2027, 2, 8),
            startAmount: 0,
            startDate: opened,
            targetDate: due,
        });

        expect(progress.standing?.elapsed).toBe(0.5);
    });
});

describe("the required line", () => {
    it("runs from the starting balance to the target", () => {
        const line = goalRequiredLine(
            { startAmount: 1000, startDate: SPAN.startDate, targetDate: SPAN.targetDate },
            4000
        );
        // Values at the ends; the times sit on day boundaries — see below.
        expect(line.at(0)?.value).toBe(1000);
        expect(line.at(-1)?.value).toBe(4000);
    });

    it("runs between day boundaries, so it agrees with the standing it is drawn against", () => {
        // Noon-to-noon anchors: interpolating over the raw instants would put the
        // line half a day out of step with `expected`, and the chart's head sits on
        // a day boundary.
        const opened = new Date(2026, 7, 13, 12, 0, 0);
        const due = new Date(2026, 7, 23, 12, 0, 0);
        const line = goalRequiredLine({ startAmount: 0, startDate: opened, targetDate: due }, 100);

        expect(line.at(0)?.time).toBe(new Date(2026, 7, 13, 0, 0, 0).getTime());
        expect(line.at(-1)?.time).toBe(new Date(2026, 7, 23, 0, 0, 0).getTime());
    });

    it("collapses to the target when the span is degenerate", () => {
        const line = goalRequiredLine({ startAmount: 0, startDate: NOW, targetDate: NOW }, 4000);
        expect(line).toHaveLength(1);
        expect(line.at(0)?.value).toBe(4000);
    });
});

describe("a goal held in a 3-decimal currency", () => {
    it("is not reached while it is still four fils short", () => {
        const twoDecimals = goalProgress(999.996, 1000);
        const threeDecimals = goalProgress(999.996, 1000, undefined, 3);

        expect(twoDecimals.remaining).toBe(0);
        expect(twoDecimals.reached).toBe(true);

        expect(threeDecimals.remaining).toBe(0.004);
        expect(threeDecimals.reached).toBe(false);
    });

    it("keeps the third decimal in what it asks for per month", () => {
        const span = {
            now: new Date(2026, 0, 1),
            startAmount: 0,
            startDate: new Date(2026, 0, 1),
            targetDate: new Date(2026, 3, 1),
        };

        expect(goalProgress(0, 100.005, span).pace?.perMonth).toBe(50);
        expect(goalProgress(0, 100.005, span, 3).pace?.perMonth).toBe(50.002);
    });
});
