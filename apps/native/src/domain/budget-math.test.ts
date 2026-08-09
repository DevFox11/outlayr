import { EN, ES } from "@/i18n/catalog";
// biome-ignore lint/performance/noNamespaceImport: the test below asserts over the module's whole export surface, which only a namespace binding can enumerate
import * as budgetMath from "./budget-math";
import {
	advanceBudgetWindow,
	BUDGET_TYPE,
	budgetPeriodPhrase,
	budgetRail,
	budgetWindowLabel,
	periodEnd,
	periodsBackTo,
	previousPeriodStart,
	shiftWindow,
	startOfPeriod,
} from "./budget-math";

const d = (y: number, m: number, day: number, h = 0, min = 0): Date => new Date(y, m - 1, day, h, min, 0, 0);

describe("periodEnd", () => {
	it("adds one day for a daily budget", () => {
		expect(periodEnd(d(2025, 1, 10), BUDGET_TYPE.day)).toStrictEqual(d(2025, 1, 11));
	});

	it("adds seven days for a weekly budget", () => {
		expect(periodEnd(d(2025, 1, 5), BUDGET_TYPE.week)).toStrictEqual(d(2025, 1, 12));
	});

	it("adds one month for a monthly budget", () => {
		expect(periodEnd(d(2025, 3, 15), BUDGET_TYPE.month)).toStrictEqual(d(2025, 4, 15));
	});

	it("clamps a month-end start to the shorter target month", () => {
		// Jan 31 + 1 month → Feb 28 (2025 is not a leap year).
		expect(periodEnd(d(2025, 1, 31), BUDGET_TYPE.month)).toStrictEqual(d(2025, 2, 28));
	});

	it("adds one year for a yearly budget", () => {
		expect(periodEnd(d(2025, 6, 1), BUDGET_TYPE.year)).toStrictEqual(d(2026, 6, 1));
	});

	it("clamps Feb 29 across a non-leap year boundary", () => {
		expect(periodEnd(d(2024, 2, 29), BUDGET_TYPE.year)).toStrictEqual(d(2025, 2, 28));
	});
});

describe("startOfPeriod", () => {
	it("anchors a daily budget to local midnight", () => {
		expect(startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.day)).toStrictEqual(d(2025, 7, 23));
	});

	it("anchors a weekly budget to the preceding Sunday", () => {
		// 2025-07-23 is a Wednesday; the Sunday before is 2025-07-20.
		expect(startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.week)).toStrictEqual(d(2025, 7, 20));
	});

	it("anchors a monthly budget to the first of the month", () => {
		expect(startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.month)).toStrictEqual(d(2025, 7, 1));
	});

	it("anchors a yearly budget to Jan 1", () => {
		expect(startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.year)).toStrictEqual(d(2025, 1, 1));
	});

	it("anchors a weekly budget to the user's first weekday", () => {
		// 2025-07-23 is a Wednesday; on a Monday week that is 2025-07-21.
		expect(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.week, {
				firstDayOfMonth: 1,
				firstWeekday: 2,
			})
		).toStrictEqual(d(2025, 7, 21));
	});

	it("anchors a monthly budget to the user's first day of month", () => {
		expect(
			startOfPeriod(d(2025, 7, 23, 14, 30), BUDGET_TYPE.month, {
				firstDayOfMonth: 25,
				firstWeekday: 1,
			})
		).toStrictEqual(d(2025, 6, 25));
	});
});

describe("advanceBudgetWindow", () => {
	it("rolls a daily budget forward to the current day", () => {
		const win = advanceBudgetWindow(d(2025, 1, 1), BUDGET_TYPE.day, d(2025, 1, 3, 12));
		expect(win.start).toStrictEqual(d(2025, 1, 3));
		expect(win.end).toStrictEqual(d(2025, 1, 4));
	});

	it("rolls a weekly budget forward to the current week", () => {
		const win = advanceBudgetWindow(d(2025, 1, 5), BUDGET_TYPE.week, d(2025, 1, 20));
		expect(win.start).toStrictEqual(d(2025, 1, 19));
		expect(win.end).toStrictEqual(d(2025, 1, 26));
	});

	it("rolls a monthly budget forward keeping the clamped month-end", () => {
		// Started Jan 31; by Mar 15 the current window is Feb 28 → Mar 28.
		const win = advanceBudgetWindow(d(2025, 1, 31), BUDGET_TYPE.month, d(2025, 3, 15));
		expect(win.start).toStrictEqual(d(2025, 2, 28));
		expect(win.end).toStrictEqual(d(2025, 3, 28));
	});

	it("rolls a yearly budget forward across a leap-day start", () => {
		const win = advanceBudgetWindow(d(2024, 2, 29), BUDGET_TYPE.year, d(2025, 6, 1));
		expect(win.start).toStrictEqual(d(2025, 2, 28));
		expect(win.end).toStrictEqual(d(2026, 2, 28));
	});

	it("leaves a window whose period has not elapsed untouched", () => {
		const start = d(2025, 7, 1);
		const win = advanceBudgetWindow(start, BUDGET_TYPE.month, d(2025, 7, 23));
		expect(win.start).toStrictEqual(start);
		expect(win.end).toStrictEqual(d(2025, 8, 1));
	});

	it("does not mutate the input start date", () => {
		const start = d(2025, 1, 1);
		advanceBudgetWindow(start, BUDGET_TYPE.day, d(2025, 1, 10));
		expect(start).toStrictEqual(d(2025, 1, 1));
	});
});

describe("budgetRail", () => {
	it("fills the leftover share of the limit while under budget", () => {
		const rail = budgetRail(192.5, 400);
		expect(rail.over).toBe(false);
		expect(rail.fill).toBe(0.518_75);
	});

	it("fills the whole track when nothing has been spent", () => {
		expect(budgetRail(0, 400)).toStrictEqual({ fill: 1, over: false });
	});

	it("empties the track at exactly the limit without calling it over", () => {
		expect(budgetRail(400, 400)).toStrictEqual({ fill: 0, over: false });
	});

	it("re-scales to the spending once over, rather than going blank", () => {
		const mild = budgetRail(2881.5, 2000);
		const severe = budgetRail(2612.5, 500);
		expect(mild.over).toBe(true);
		expect(severe.over).toBe(true);
		expect(mild.fill > 0).toBeTruthy();
		expect(severe.fill < mild.fill).toBeTruthy();
	});

	it("reports the limit's share of the spending when over", () => {
		expect(budgetRail(1000, 250).fill).toBe(0.25);
	});

	it("clamps a refund past zero spend to a full track", () => {
		expect(budgetRail(-50, 400)).toStrictEqual({ fill: 1, over: false });
	});

	it("draws nothing for a zero limit rather than dividing to NaN", () => {
		expect(budgetRail(0, 0)).toStrictEqual({ fill: 0, over: false });
		expect(budgetRail(100, 0)).toStrictEqual({ fill: 0, over: true });
	});
});

describe("previousPeriodStart", () => {
	it("steps back one whole period of each type", () => {
		expect(previousPeriodStart(d(2025, 1, 11), BUDGET_TYPE.day)).toStrictEqual(d(2025, 1, 10));
		expect(previousPeriodStart(d(2025, 1, 12), BUDGET_TYPE.week)).toStrictEqual(d(2025, 1, 5));
		expect(previousPeriodStart(d(2025, 4, 15), BUDGET_TYPE.month)).toStrictEqual(d(2025, 3, 15));
		expect(previousPeriodStart(d(2026, 6, 1), BUDGET_TYPE.year)).toStrictEqual(d(2025, 6, 1));
	});

	it("stands still on an unknown type rather than running away", () => {
		expect(previousPeriodStart(d(2025, 1, 11), 99)).toStrictEqual(d(2025, 1, 11));
	});
});

describe("shiftWindow", () => {
	it("returns the window it was handed at offset zero", () => {
		expect(shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, 0)).toStrictEqual({
			end: d(2025, 8, 1),
			start: d(2025, 7, 1),
		});
	});

	it("steps back whole periods", () => {
		expect(shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, -4)).toStrictEqual({
			end: d(2025, 4, 1),
			start: d(2025, 3, 1),
		});
		expect(shiftWindow(d(2025, 7, 21), BUDGET_TYPE.week, -3)).toStrictEqual({
			end: d(2025, 7, 7),
			start: d(2025, 6, 30),
		});
	});

	it("round-trips a step back and forward", () => {
		const back = shiftWindow(d(2025, 7, 1), BUDGET_TYPE.month, -1);
		expect(shiftWindow(back.start, BUDGET_TYPE.month, 1)).toStrictEqual({
			end: d(2025, 8, 1),
			start: d(2025, 7, 1),
		});
	});
});

describe("periodsBackTo", () => {
	it("offers no step back when nothing predates the current window", () => {
		expect(periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 7, 14))).toBe(0);
		expect(periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, null)).toBe(0);
	});

	it("counts the steps that reach the oldest entry", () => {
		// March 12 sits inside the window starting March 1, four back from July.
		expect(periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 3, 12))).toBe(4);
	});

	it("stops on the window that contains the oldest entry, not past it", () => {
		expect(periodsBackTo(d(2025, 7, 1), BUDGET_TYPE.month, d(2025, 6, 1))).toBe(1);
	});

	it("does not loop forever on a type with no period length", () => {
		expect(periodsBackTo(d(2025, 7, 1), 99, d(2000, 1, 1))).toBe(0);
	});
});

describe("budgetPeriodPhrase", () => {
	it("names the span each budget type covers", () => {
		expect(EN[budgetPeriodPhrase(BUDGET_TYPE.day)]).toBe("today");
		expect(EN[budgetPeriodPhrase(BUDGET_TYPE.week)]).toBe("this week");
		expect(EN[budgetPeriodPhrase(BUDGET_TYPE.month)]).toBe("this month");
		expect(EN[budgetPeriodPhrase(BUDGET_TYPE.year)]).toBe("this year");
	});

	it("falls back to an unnamed span for a type it does not know", () => {
		expect(EN[budgetPeriodPhrase(99)]).toBe("this period");
	});

	it("returns a key every language resolves", () => {
		for (const type of [BUDGET_TYPE.day, BUDGET_TYPE.week, BUDGET_TYPE.month, BUDGET_TYPE.year, 99]) {
			const key = budgetPeriodPhrase(type);
			expect(ES[key]).toBeTruthy();
			// The parity gate only counts keys, so an entry left as a copy of the
			// English is what it cannot see.
			expect(ES[key]).not.toBe(EN[key]);
		}
	});

	it("no longer ships the reset phrase nothing rendered", () => {
		expect(!Object.keys(budgetMath).includes("budgetResetPhrase")).toBeTruthy();
	});
});

describe("budgetWindowLabel", () => {
	it("names a single day with its year", () => {
		expect(budgetWindowLabel({ end: d(2025, 7, 24), start: d(2025, 7, 23) }, BUDGET_TYPE.day)).toBe("23 JUL 2025");
	});

	it("spans a month to its last day, not the next window's first", () => {
		expect(budgetWindowLabel({ end: d(2025, 7, 1), start: d(2025, 6, 1) }, BUDGET_TYPE.month)).toBe("1 JUN – 30 JUN");
	});

	it("spans a week inclusively", () => {
		expect(budgetWindowLabel({ end: d(2025, 7, 7), start: d(2025, 6, 30) }, BUDGET_TYPE.week)).toBe("30 JUN – 6 JUL");
	});

	it("carries two-digit years on a yearly window", () => {
		expect(budgetWindowLabel({ end: d(2026, 1, 1), start: d(2025, 1, 1) }, BUDGET_TYPE.year)).toBe(
			"1 JAN 25 – 31 DEC 25"
		);
	});
});
