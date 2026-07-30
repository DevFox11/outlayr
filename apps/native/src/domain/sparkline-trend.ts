import type { TranslationKey } from "@/i18n/catalog";
import type { LogMeasure } from "./log-measure";

/**
 * Which way a running series ran, as a sentence rather than a hue. The stroke
 * says this with `income` against `danger`, which is the whole of the
 * information for anyone who cannot separate the two.
 *
 * First sample against last, not a fit through the middle: what the line is
 * asked to answer is whether the window closed above or below where it opened,
 * which is exactly what `sparklineIsPositive` colours it on. A series of fewer
 * than two samples has no movement to report and reads as flat, so callers get
 * a total function instead of a fourth case to branch on.
 */
export function sparklineTrendKey(amounts: readonly number[]): TranslationKey {
	const first = amounts[0];
	const last = amounts.at(-1);
	if (first === undefined || last === undefined || first === last) {
		return "insights.trend.flat";
	}
	return last > first ? "insights.trend.rising" : "insights.trend.falling";
}

/**
 * What the sparkline is, spoken.
 *
 * Only Net is a running balance, and only a running balance has a direction to
 * report: its opening sample is the ledger's real balance at the window's edge.
 * In and Out are per-bucket sums whose opening bucket `sparklineSeries` empties
 * by construction — its window guard admits nothing that far back — so their
 * first sample is always zero, and a sum of unsigned amounts can never close
 * below it. "Falling" is unreachable for those two, which leaves a direction
 * that can only ever flatter the line. They name the granularity they plot
 * instead of inventing a movement.
 */
export function sparklineLabelKey(
	measure: LogMeasure,
	amounts: readonly number[],
	byMonth: boolean,
): TranslationKey {
	if (measure === "net") {
		return sparklineTrendKey(amounts);
	}
	return byMonth
		? "insights.trend.monthlyTotals"
		: "insights.trend.dailyTotals";
}
