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

const STORED: Record<LogMeasure, number> = { net: 1, in: 2, out: 3 };

export function logMeasureFromStored(value: number): LogMeasure {
	return LOG_MEASURE_ORDER.find((m) => STORED[m] === value) ?? "net";
}

export function storedLogMeasure(measure: LogMeasure): number {
	return STORED[measure];
}

/** One short word, so all three fit across the narrowest phone. */
export const LOG_MEASURE_WORD: Record<LogMeasure, string> = {
	net: "Net",
	in: "In",
	out: "Out",
};

export interface LogFigures {
	currencyCode: string;
	income: number;
	expense: number;
	count: number;
}

export const ZERO_FIGURES: Omit<LogFigures, "currencyCode"> = {
	income: 0,
	expense: 0,
	count: 0,
};

export function netTotal(figures: LogFigures): number {
	return figures.income - figures.expense;
}

/** Unsigned — the sign comes from {@link measureIsPositive}. */
export function measureMagnitude(
	measure: LogMeasure,
	figures: LogFigures,
): number {
	switch (measure) {
		case "net":
			return Math.abs(netTotal(figures));
		case "in":
			return figures.income;
		case "out":
			return figures.expense;
	}
}

export function measureIsPositive(
	measure: LogMeasure,
	figures: LogFigures,
): boolean {
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
