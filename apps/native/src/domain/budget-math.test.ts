import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	advanceBudgetWindow,
	BUDGET_TYPE,
	budgetRail,
	budgetWindowLabel,
	periodEnd,
	periodsBackTo,
	previousPeriodStart,
	shiftWindow,
	startOfPeriod,
} from "./budget-math";

const d = (y: number, m: number, day: number, h = 0, min = 0): Date =>
	new Date(y, m - 1, day, h, min, 0, 0);

describe("periodEnd", () => {
	it("adds one day for a daily budget", () => {
		assert.deepEqual(
			periodEnd(d(2025, 1, 10), BUDGET_TYPE.day),
			d(2025, 1, 11),
		);
	});

	it("adds seven days for a weekly budget", () => {
		assert.deepEqual(
			periodEnd(d(2025, 1, 5), BUDGET_TYPE.week),
			d(2025, 1, 12),
		);
	});

	it("adds one month for a monthly budget", () => {
		assert.deepEqual(
			periodEnd(d(2025, 3, 15), BUDGET_TYPE.month),
			d(2025, 4, 15),
		);
	});

	it("clamps a month-end start to the shorter target month", () => {
		// Jan 31 + 1 month → Feb 28 (2025 is not a leap year).
		assert.deepEqual(
			periodEnd(d(2025, 1, 31), BUDGET_TYPE.month),
			d(2025, 2, 28),
		);
	});

	it("adds one year for a yearly budget", () => {
		assert.deepEqual(periodEnd(d(2025, 6, 1), BUDGET_TYPE.year), d(2026, 6, 1));
	});

	it("clamps Feb 29 across a non-leap year boundary", () => {
		assert.deepEqual(
			periodEnd(d(2024, 2, 29), BUDGET_TYPE.year),
			d(2025, 2, 28),
		);
	});
});

describe("startOfPeriod", () => {
	it("anchors a daily budget to local midnight", () => {
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.day),
			d(2025, 7, 23),
		);
	});

	it("anchors a weekly budget to the preceding Sunday", () => {
		// 2025-07-23 is a Wednesday; the Sunday before is 2025-07-20.
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.week),
			d(2025, 7, 20),
		);
	});

	it("anchors a monthly budget to the first of the month", () => {
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.month),
			d(2025, 7, 1),
		);
	});

	it("anchors a yearly budget to Jan 1", () => {
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.year),
			d(2025, 1, 1),
		);
	});

	it("anchors a weekly budget to the user's first weekday", () => {
		// 2025-07-23 is a Wednesday; on a Monday week that is 2025-07-21.
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.week, {
				firstWeekday: 2,
				firstDayOfMonth: 1,
			}),
			d(2025, 7, 21),
		);
	});

	it("anchors a monthly budget to the user's first day of month", () => {
		assert.deepEqual(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.month, {
				firstWeekday: 1,
				firstDayOfMonth: 25,
			}),
			d(2025, 6, 25),
		);
	});
});

describe("advanceBudgetWindow", () => {
	it("rolls a daily budget forward to the current day", () => {
		const win = advanceBudgetWindow(
			d(2025, 1, 1),
			BUDGET_TYPE.day,
			d(2025, 1, 3, 12),
		);
		assert.deepEqual(win.start, d(2025, 1, 3));
		assert.deepEqual(win.end, d(2025, 1, 4));
	});

	it("rolls a weekly budget forward to the current week", () => {
		const win = advanceBudgetWindow(
			d(2025, 1, 5),
			BUDGET_TYPE.week,
			d(2025, 1, 20),
		);
		assert.deepEqual(win.start, d(2025, 1, 19));
		assert.deepEqual(win.end, d(2025, 1, 26));
	});

	it("rolls a monthly budget forward keeping the clamped month-end", () => {
		// Started Jan 31; by Mar 15 the current window is Feb 28 → Mar 28.
		const win = advanceBudgetWindow(
			d(2025, 1, 31),
			BUDGET_TYPE.month,
			d(2025, 3, 15),
		);
		assert.deepEqual(win.start, d(2025, 2, 28));
		assert.deepEqual(win.end, d(2025, 3, 28));
	});

	it("rolls a yearly budget forward across a leap-day start", () => {
		const win = advanceBudgetWindow(
			d(2024, 2, 29),
			BUDGET_TYPE.year,
			d(2025, 6, 1),
		);
		assert.deepEqual(win.start, d(2025, 2, 28));
		assert.deepEqual(win.end, d(2026, 2, 28));
	});

	it("leaves a window whose period has not elapsed untouched", () => {
		const start = d(2025, 7, 1);
		const win = advanceBudgetWindow(start, BUDGET_TYPE.month, d(2025, 7, 23));
		assert.deepEqual(win.start, start);
		assert.deepEqual(win.end, d(2025, 8, 1));
	});

	it("does not mutate the input start date", () => {
		const start = d(2025, 1, 1);
		advanceBudgetWindow(start, BUDGET_TYPE.day, d(2025, 1, 10));
		assert.deepEqual(start, d(2025, 1, 1));
	});
});

describe("budgetRail", () => {
	it("fills the leftover share of the limit while under budget", () => {
		const rail = budgetRail(192.5, 400);
		assert.equal(rail.over, false);
		assert.equal(rail.fill, 0.51875);
	});

	it("fills the whole track when nothing has been spent", () => {
		assert.deepEqual(budgetRail(0, 400), { fill: 1, over: false });
	});

	it("empties the track at exactly the limit without calling it over", () => {
		assert.deepEqual(budgetRail(400, 400), { fill: 0, over: false });
	});

	it("re-scales to the spending once over, rather than going blank", () => {
		const mild = budgetRail(2881.5, 2000);
		const severe = budgetRail(2612.5, 500);
		assert.equal(mild.over, true);
		assert.equal(severe.over, true);
		assert.ok(mild.fill > 0, "a 144% rail must still draw something");
		assert.ok(
			severe.fill < mild.fill,
			"a worse overage must read as a shorter stub",
		);
	});

	it("reports the limit's share of the spending when over", () => {
		assert.equal(budgetRail(1000, 250).fill, 0.25);
	});

	it("clamps a refund past zero spend to a full track", () => {
		assert.deepEqual(budgetRail(-50, 400), { fill: 1, over: false });
	});

	it("draws nothing for a zero limit rather than dividing to NaN", () => {
		assert.deepEqual(budgetRail(0, 0), { fill: 0, over: false });
		assert.deepEqual(budgetRail(100, 0), { fill: 0, over: true });
	});
});

describe("previousPeriodStart", () => {
	it("steps back one whole period of each type", () => {
		assert.deepEqual(
			previousPeriodStart(d(2025, 1, 11), BUDGET_TYPE.day),
			d(2025, 1, 10),
		);
		assert.deepEqual(
			previousPeriodStart(d(2025, 1, 12), BUDGET_TYPE.week),
			d(2025, 1, 5),
		);
		assert.deepEqual(
			previousPeriodStart(d(2025, 4, 15), BUDGET_TYPE.month),
			d(2025, 3, 15),
		);
		assert.deepEqual(
			previousPeriodStart(d(2026, 6, 1), BUDGET_TYPE.year),
			d(2025, 6, 1),
		);
	});

	it("stands still on an unknown type rather than running away", () => {
		assert.deepEqual(previousPeriodStart(d(2025, 1, 11), 99), d(2025, 1, 11));
	});
});

describe("shiftWindow", () => {
	it("returns the window it was handed at offset zero", () => {
		assert.deepEqual(shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, 0), {
			start: d(2025, 7, 1),
			end: d(2025, 8, 1),
		});
	});

	it("steps back whole periods", () => {
		assert.deepEqual(shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, -4), {
			start: d(2025, 3, 1),
			end: d(2025, 4, 1),
		});
		assert.deepEqual(shiftWindow(d(2025, 7, 21), BUDGET_TYPE.week, -3), {
			start: d(2025, 6, 30),
			end: d(2025, 7, 7),
		});
	});

	it("round-trips a step back and forward", () => {
		const back = shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, -1);
		assert.deepEqual(shiftWindow(back.start, BUDGET_TYPE.month, 1), {
			start: d(2025, 7, 1),
			end: d(2025, 8, 1),
		});
	});
});

describe("periodsBackTo", () => {
	it("offers no step back when nothing predates the current window", () => {
		assert.equal(
			periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 7, 14)),
			0,
		);
		assert.equal(periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, null), 0);
	});

	it("counts the steps that reach the oldest entry", () => {
		// March 12 sits inside the window starting March 1, four back from July.
		assert.equal(
			periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 3, 12)),
			4,
		);
	});

	it("stops on the window that contains the oldest entry, not past it", () => {
		assert.equal(
			periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 6, 1)),
			1,
		);
	});

	it("does not loop forever on a type with no period length", () => {
		assert.equal(periodsBackTo(d(2025, 7, 1), 99, d(2000, 1, 1)), 0);
	});
});

describe("budgetWindowLabel", () => {
	it("names a single day with its year", () => {
		assert.equal(
			budgetWindowLabel(
				{ start: d(2025, 7, 23), end: d(2025, 7, 24) },
				BUDGET_TYPE.day,
			),
			"23 JUL 2025",
		);
	});

	it("spans a month to its last day, not the next window's first", () => {
		assert.equal(
			budgetWindowLabel(
				{ start: d(2025, 6, 1), end: d(2025, 7, 1) },
				BUDGET_TYPE.month,
			),
			"1 JUN – 30 JUN",
		);
	});

	it("spans a week inclusively", () => {
		assert.equal(
			budgetWindowLabel(
				{ start: d(2025, 6, 30), end: d(2025, 7, 7) },
				BUDGET_TYPE.week,
			),
			"30 JUN – 6 JUL",
		);
	});

	it("carries two-digit years on a yearly window", () => {
		assert.equal(
			budgetWindowLabel(
				{ start: d(2025, 1, 1), end: d(2026, 1, 1) },
				BUDGET_TYPE.year,
			),
			"1 JAN 25 – 31 DEC 25",
		);
	});
});
