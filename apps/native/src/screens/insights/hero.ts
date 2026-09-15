import type { CategoryBreakdownEntry, InsightsBucket, InsightsMeasure } from "@/data/insights";
import type { InsightsTotals } from "@/domain/insights-measure";
import {
    insightsMeasureIsIncome,
    insightsMeasureIsPositive,
    insightsMeasureMagnitude,
} from "@/domain/insights-measure";

/**
 * What the Insights hero prints, split from the screen so the two halves can be
 * held together: the magnitude and the sign have to describe the SAME thing, and
 * they each pick it from the same ordered list of what is selected.
 */
export function heroMagnitudeFor(
    filteredEntry: CategoryBreakdownEntry | null,
    readBalance: number | null,
    readBucket: InsightsBucket | null,
    measure: InsightsMeasure,
    totals: InsightsTotals
): number {
    if (filteredEntry) {
        return filteredEntry.amount;
    }
    if (readBalance != null) {
        return Math.abs(readBalance);
    }
    if (readBucket) {
        return Math.abs(readBucket.value);
    }
    return insightsMeasureMagnitude(measure, totals);
}

export function heroPositiveFor(
    filteredEntry: CategoryBreakdownEntry | null,
    readBalance: number | null,
    readBucket: InsightsBucket | null,
    isNet: boolean,
    measure: InsightsMeasure,
    totals: InsightsTotals
): boolean {
    // Same first branch as its magnitude twin, or the two disagree about what
    // they are describing. The breakdown collects `row.income === (measure ===
    // "income")`, so under Net a filtered category is money that LEFT — and the
    // window's own net sign says nothing about it.
    if (filteredEntry) {
        return insightsMeasureIsIncome(measure);
    }
    if (readBalance != null) {
        return readBalance >= 0;
    }
    if (readBucket && isNet) {
        return readBucket.value >= 0;
    }
    return insightsMeasureIsPositive(measure, totals);
}
