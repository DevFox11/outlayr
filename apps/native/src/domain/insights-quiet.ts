import type { InsightsMeasure } from "@/data/insights";
import {
	type InsightsTotals,
	insightsMeasureAlternatives,
	insightsMeasureMagnitude,
	netTotal,
} from "./insights-measure";

/**
 * `net` needs money in both directions: with one of them empty the net is only
 * the other direction restated with a sign.
 */
function hasFigure(measure: InsightsMeasure, totals: InsightsTotals): boolean {
	if (measure === "net") {
		return totals.income !== 0 && totals.spent !== 0 && netTotal(totals) !== 0;
	}
	return insightsMeasureMagnitude(measure, totals) !== 0;
}

/**
 * Where to send someone when the promoted measure has nothing to chart; null
 * when the window is empty in every direction.
 *
 * Candidates are walked in declaration order — spent, income, then net — so a
 * plain direction always beats the derived figure, and the answer never depends
 * on which measure happens to be promoted.
 */
export function quietAlternative(measure: InsightsMeasure, totals: InsightsTotals): InsightsMeasure | null {
	return insightsMeasureAlternatives(measure).find((m) => hasFigure(m, totals)) ?? null;
}
