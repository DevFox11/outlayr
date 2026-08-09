import type { InsightsMeasure } from "@/data/insights";

export const INSIGHTS_MEASURE_ORDER: readonly InsightsMeasure[] = ["spent", "income", "net"];

const STORED: Record<InsightsMeasure, number> = { income: 2, net: 3, spent: 1 };

export function insightsMeasureFromStored(value: number): InsightsMeasure {
	return INSIGHTS_MEASURE_ORDER.find((m) => STORED[m] === value) ?? "spent";
}

export function storedInsightsMeasure(measure: InsightsMeasure): number {
	return STORED[measure];
}

/** The window's two raw magnitudes; the net is derived, never stored. */
export interface InsightsTotals {
	income: number;
	spent: number;
}

export function netTotal(totals: InsightsTotals): number {
	return totals.income - totals.spent;
}

/** Unsigned — the sign comes from {@link insightsMeasureIsPositive}. */
export function insightsMeasureMagnitude(measure: InsightsMeasure, totals: InsightsTotals): number {
	switch (measure) {
		case "income":
			return totals.income;
		case "net":
			return Math.abs(netTotal(totals));
		default:
			return totals.spent;
	}
}

export function insightsMeasureIsPositive(measure: InsightsMeasure, totals: InsightsTotals): boolean {
	switch (measure) {
		case "income":
			return true;
		case "net":
			return netTotal(totals) >= 0;
		default:
			return false;
	}
}

/**
 * Only money actually coming in earns the income colour; a positive net is
 * still just a net.
 */
export function insightsMeasureIsIncome(measure: InsightsMeasure): boolean {
	return measure === "income";
}

/**
 * Declaration order, never an order that depends on which measure is promoted —
 * a pair that reshuffles under your thumb is how you tap the wrong one.
 */
export function insightsMeasureAlternatives(measure: InsightsMeasure): InsightsMeasure[] {
	return INSIGHTS_MEASURE_ORDER.filter((m) => m !== measure);
}

/** Whether the **hero figure** going up is good news. */
export function measureRiseIsFavourable(measure: InsightsMeasure): boolean {
	return measure !== "spent";
}

/**
 * Whether a **category's** figure going up is good news.
 *
 * Deliberately not the same rule as {@link measureRiseIsFavourable}, and `net`
 * is exactly where they part company: `categoryBreakdown` reads the *outflow*
 * composition for both `spent` and `net`, and only `income` reads inflow. So
 * under `net` the hero rising is good while a category rising is not.
 */
export function breakdownRiseIsFavourable(measure: InsightsMeasure): boolean {
	return measure === "income";
}
