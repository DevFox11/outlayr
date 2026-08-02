import type { ExpenseContribution } from "@/data/budget-spent";
import { buildBurndown } from "./budget-burndown";
import type { BudgetWindow } from "./budget-math";

const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

const JULY: BudgetWindow = { start: at(2026, 7, 1), end: at(2026, 8, 1) };

function expense(
	day: number,
	amount: number,
	categoryId: string | null = null,
	parentId: string | null = null,
): ExpenseContribution {
	return { amount, categoryId, parentId, date: at(2026, 7, day) };
}

/**
 * The exact expense set the simulator's Log tab shows for July 2026. It sums to
 * $2,881.50 against a $2,000 limit, so it pins the whole burn-down to a state we
 * have a screenshot of.
 */
const REAL_JULY: ExpenseContribution[] = [
	expense(1, 15),
	expense(9, 90),
	expense(15, 35),
	expense(18, 22),
	expense(20, 60),
	expense(21, 8.75),
	expense(22, 45),
	expense(22, 12.75),
	expense(23, 20),
	expense(23, 2500),
	expense(23, 12.5),
	expense(23, 42.5),
	expense(23, 18),
];

describe("buildBurndown", () => {
	it("reproduces the spend and overage the Budgets screen shows", () => {
		const result = buildBurndown(REAL_JULY, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		const today = result.points.at(-1);
		expect(today?.spent).toBe(2881.5);
		expect(today?.balance).toBe(-881.5);
	});

	it("reports the day the balance first went negative", () => {
		const result = buildBurndown(REAL_JULY, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		expect(result.runwayDay).toBe(23);
		expect(result.runwayDate).toStrictEqual(at(2026, 7, 23));
	});

	it("leaves the runway empty while the budget still holds", () => {
		const result = buildBurndown([expense(3, 120)], {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		expect(result.runwayDay).toBe(null);
		expect(result.runwayDate).toBe(null);
	});

	it("stops the actual series at today rather than the window end", () => {
		const result = buildBurndown(REAL_JULY, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		expect(result.totalDays).toBe(31);
		expect(result.points.length).toBe(25);
		expect(result.points.at(-1)?.day).toBe(25);
	});

	it("carries the balance across days with no spending", () => {
		const result = buildBurndown([expense(1, 100)], {
			limit: 500,
			window: JULY,
			now: at(2026, 7, 4),
		});

		expect(result.points.map((p) => p.balance)).toStrictEqual([
			400, 400, 400, 400,
		]);
	});

	it("counts a subcategory's spending toward its parent's budget", () => {
		const rows = [
			expense(2, 30, "dining", null),
			expense(3, 45, "coffee", "dining"),
			expense(4, 90, "transport", null),
		];

		const result = buildBurndown(rows, {
			limit: 500,
			window: JULY,
			now: at(2026, 7, 10),
			categoryId: "dining",
		});

		expect(result.points.at(-1)?.spent).toBe(75);
	});

	it("ignores expenses outside the window", () => {
		const rows = [
			{ amount: 999, categoryId: null, parentId: null, date: at(2026, 6, 30) },
			expense(5, 40),
			{ amount: 777, categoryId: null, parentId: null, date: at(2026, 8, 2) },
		];

		const result = buildBurndown(rows, {
			limit: 500,
			window: JULY,
			now: at(2026, 7, 10),
		});

		expect(result.points.at(-1)?.spent).toBe(40);
	});

	it("ignores expenses dated after now but still inside the window", () => {
		const result = buildBurndown([expense(5, 40), expense(28, 500)], {
			limit: 500,
			window: JULY,
			now: at(2026, 7, 10),
		});

		expect(result.points.at(-1)?.spent).toBe(40);
	});

	it("projects the end-of-window balance from the current rate", () => {
		// 10 days elapsed of 31, $100/day.
		const rows = Array.from({ length: 10 }, (_, i) => expense(i + 1, 100));

		const result = buildBurndown(rows, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 10),
		});

		// 31 days x $100 = $3,100 spent, against a $2,000 limit.
		expect(result.projectedBalance).toBe(-1100);
	});

	it("keeps a lone outlier from dominating the projection", () => {
		const result = buildBurndown(REAL_JULY, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		// A mean rate spreads the single $2,500 charge across all 31 days and
		// forecasts -$1,573. Taking a typical purchase instead lands near the
		// -$881.50 already spent, plus a realistic six days more of small ones.
		expect(
			result.projectedBalance != null && result.projectedBalance > -1100,
		).toBeTruthy();
		expect(result.projectedBalance).toBe(-970.54);
	});

	it("keeps forecasting for someone who only shops some days", () => {
		// 3 spend days of 10 elapsed: a median over the zero-padded calendar is 0,
		// which would forecast no future spending at all.
		const rows = [expense(1, 300), expense(2, 300), expense(3, 300)];

		const result = buildBurndown(rows, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 10),
		});

		// $300 a shop, 3 shops in 10 days, 21 days left: 300 * 0.3 * 21 = 1890.
		expect(result.projectedBalance).toBe(2000 - 900 - 1890);
	});

	it("still warns before the blowout when spending is sparse", () => {
		// The state the hero's ENDS SHORT footer exists for: solvent today, but
		// pacing into the ground on 10 shopping days out of 25 elapsed.
		const rows = [0, 2, 4, 7, 9, 12, 15, 18, 21, 24].map((offset) =>
			expense(offset + 1, 190),
		);

		const result = buildBurndown(rows, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 25),
		});

		expect(result.runwayDay).toBe(null);
		expect(
			result.projectedBalance != null && result.projectedBalance < 0,
		).toBeTruthy();
		expect(result.projectedBalance).toBe(-356);
	});

	it("averages the middle pair when an even number of days has elapsed", () => {
		const rows = [10, 20, 30, 40, 50, 60, 70, 80].map((amount, i) =>
			expense(i + 1, amount),
		);

		const result = buildBurndown(rows, {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 8),
		});

		// Median of 8 days is (40 + 50) / 2 = 45, across the 23 days left.
		expect(result.projectedBalance).toBe(2000 - 360 - 45 * 23);
	});

	it("withholds the projection while too little of the window has elapsed", () => {
		const result = buildBurndown([expense(1, 900)], {
			limit: 2000,
			window: JULY,
			now: at(2026, 7, 2),
		});

		expect(result.projectedBalance).toBe(null);
	});

	it("survives a zero limit without dividing by it", () => {
		const result = buildBurndown([expense(2, 50)], {
			limit: 0,
			window: JULY,
			now: at(2026, 7, 10),
		});

		expect(result.points.at(-1)?.balance).toBe(-50);
		expect(result.runwayDay).toBe(2);
	});

	it("buckets by calendar day so a DST shift cannot smear spending", () => {
		// US DST ends Nov 1 2026; Nov 2 is a 25-hour day away from the start.
		const november: BudgetWindow = {
			start: at(2026, 11, 1),
			end: at(2026, 12, 1),
		};
		const rows = [
			{ amount: 10, categoryId: null, parentId: null, date: at(2026, 11, 1) },
			{ amount: 20, categoryId: null, parentId: null, date: at(2026, 11, 3) },
		];

		const result = buildBurndown(rows, {
			limit: 100,
			window: november,
			now: at(2026, 11, 5),
		});

		expect(result.points.map((p) => p.spent)).toStrictEqual([
			10, 10, 30, 30, 30,
		]);
	});
});
