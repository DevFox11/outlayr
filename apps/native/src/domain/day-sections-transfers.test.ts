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

	it("keeps the per-currency buckets free of it too", () => {
		const [section] = groupByDay(
			[row(50, false), row(100, true, { currency: "VES", excludedFromTotals: true })],
			"USD"
		);

		expect(section.totals.map((bucket) => bucket.currencyCode)).toEqual(["USD"]);
	});

	it("reports a zero total for a day that holds nothing but transfers", () => {
		const [section] = groupByDay([row(100, false, { excludedFromTotals: true })], "USD");

		expect(section.total).toBe(0);
		expect(section.data).toHaveLength(1);
	});

	it("counts a fee, which is an ordinary expense that happens to belong to a transfer", () => {
		const [section] = groupByDay(
			[row(100, false, { excludedFromTotals: true }), row(2.7, false, { transferId: "t1" })],
			"USD"
		);

		expect(section.total).toBe(-2.7);
	});

	it("is unchanged for a day with no transfers at all", () => {
		const [section] = groupByDay([row(6.4, false), row(40, false)], "USD");

		expect(section.total).toBe(-46.4);
	});
});
