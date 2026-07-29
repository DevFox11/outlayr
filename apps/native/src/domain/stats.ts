/**
 * Middle value of a series, averaging the middle pair on an even count. Null on
 * an empty series, so callers decide what "no evidence" means rather than
 * inheriting a zero that reads like a real measurement.
 */
export function median(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}
