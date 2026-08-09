/**
 * The one chart language: anything that draws a rule, a dash, a bar or a scrub
 * marker reads its geometry from here.
 *
 * The track behind a bar or rail is not here — it is `bg-rail-track`, a uniwind
 * class, which `useColors` also exposes as a string for the charts that need it.
 *
 * Skia is used where there are curves, fills or clipping; bars, rails and stacked
 * segments stay plain views.
 */

/**
 * Dash intervals. Each pattern carries exactly one meaning across every chart, so
 * adding a pattern means inventing a meaning.
 */
export const CHART_DASH = {
	/** A projection: where things land if nothing changes. Not observed data. */
	projection: [3.5, 3.5],
	/** A target, an ideal, or an average — a line the data is measured against. */
	reference: [1.5, 4],
} as const;

/** `react-native-svg` wants the intervals as a string; Skia wants the array. */
export function dashArray(intervals: readonly number[]): string {
	return intervals.join(" ");
}

/**
 * The rule is solid on purpose: a dashed one would collide with
 * `CHART_DASH.projection` and read as a forecast rather than as where your
 * finger is.
 */
export const CHART_SCRUB = {
	activeDotRadius: 4.5,
	dotRadius: 3.2,
	/** How far the rule runs past the plot, top and bottom, so it reads as a cut. */
	ruleOvershoot: 6,
	ruleWidth: 1,
} as const;

export const CHART_BAR = {
	/** A non-zero value never renders as nothing. */
	minHeight: 3,
	/**
	 * Cornered, not pilled: `rounded-full` on a short bar swallows the value into
	 * two caps. Rails, which are always thin and always full-width, stay pilled.
	 */
	radius: 6,
} as const;

/** The grow-in: one duration and one easing for every chart. */
export const CHART_DRAW = {
	durationMs: 600,
} as const;

/**
 * An axis maximum rounded up to something a person would say out loud, with 10%
 * of headroom so the tallest bar never touches the ceiling.
 */
export function axisMax(peak: number): number {
	return Math.max(10, Math.ceil((peak * 1.1) / 10) * 10);
}

/** Compact magnitude for an axis label: 950, 1.2k, 15k, 3M. */
export function compactMagnitude(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) {
		return `${trim(value / 1_000_000, abs >= 10_000_000)}M`;
	}
	if (abs >= 1000) {
		return `${trim(value / 1000, abs >= 10_000)}k`;
	}
	return String(Math.round(value));
}

const TRAILING_ZERO_DECIMAL = /\.0$/;

function trim(value: number, whole: boolean): string {
	return whole ? String(Math.round(value)) : value.toFixed(1).replace(TRAILING_ZERO_DECIMAL, "");
}
