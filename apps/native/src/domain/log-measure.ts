/**
 * Mirrors the Swift `LogMeasure` enum. The stored numbers match the
 * `logInsightsType` preference the Swift app writes, so an install carried over
 * keeps showing what it showed.
 */
export type LogMeasure = "net" | "in" | "out";

/**
 * Declaration order, which is also the order the two unpromoted cells render in:
 * the pair under the hero must not reshuffle as the promotion changes.
 */
export const LOG_MEASURE_ORDER: readonly LogMeasure[] = ["net", "in", "out"];

const STORED: Record<LogMeasure, number> = { in: 2, net: 1, out: 3 };

export function logMeasureFromStored(value: number): LogMeasure {
	return LOG_MEASURE_ORDER.find((m) => STORED[m] === value) ?? "net";
}

export function storedLogMeasure(measure: LogMeasure): number {
	return STORED[measure];
}

/** One short word, so all three fit across the narrowest phone. */
export const LOG_MEASURE_WORD: Record<LogMeasure, string> = {
	in: "In",
	net: "Net",
	out: "Out",
};

export interface LogFigures {
	count: number;
	currencyCode: string;
	expense: number;
	income: number;
}

export const ZERO_FIGURES: Omit<LogFigures, "currencyCode"> = {
	count: 0,
	expense: 0,
	income: 0,
};

export function netTotal(figures: LogFigures): number {
	return figures.income - figures.expense;
}

/** Unsigned — the sign comes from {@link measureIsPositive}. */
export function measureMagnitude(measure: LogMeasure, figures: LogFigures): number {
	// biome-ignore lint/style/useDefaultSwitchClause: `LogMeasure` is a closed union — a default clause would swallow the missing-return error that forces a new member to be handled here
	switch (measure) {
		case "net":
			return Math.abs(netTotal(figures));
		case "in":
			return figures.income;
		case "out":
			return figures.expense;
	}
}

export function measureIsPositive(measure: LogMeasure, figures: LogFigures): boolean {
	// biome-ignore lint/style/useDefaultSwitchClause: `LogMeasure` is a closed union — a default clause would swallow the missing-return error that forces a new member to be handled here
	switch (measure) {
		case "net":
			return netTotal(figures) >= 0;
		case "in":
			return true;
		case "out":
			return false;
	}
}

/**
 * Only money actually coming in earns the income color; a positive net is still
 * just a net.
 */
export function measureIsIncome(measure: LogMeasure): boolean {
	return measure === "in";
}

export function measureAlternatives(measure: LogMeasure): LogMeasure[] {
	return LOG_MEASURE_ORDER.filter((m) => m !== measure);
}
