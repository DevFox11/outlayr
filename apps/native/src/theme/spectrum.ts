/**
 * The conic spectrum behind the auto-color hints, ported from Swift's
 * `SpectrumHint`. Six stops wrapping red back to red so the sweep closes
 * seamlessly. Swift feeds these straight to an `AngularGradient`; React Native
 * has no conic gradient anywhere in the stack (react-native-svg ships only
 * Linear/Radial, and RN's `experimental_backgroundImage` implements only
 * linear/radial), so the ring is approximated by ramping between the stops.
 */
export const SPECTRUM_STOPS = [
	"#FF4444",
	"#FFBB00",
	"#33CC66",
	"#0099FF",
	"#AA44FF",
	"#FF4444",
] as const;

/**
 * Samples {@link SPECTRUM_STOPS} into `count` evenly spaced `#RRGGBB` colors.
 * Sampling at segment *centres* rather than edges keeps the first and last
 * segment equidistant from the wrap point, so the seam where red meets red is no
 * more visible than any other boundary.
 */
export function spectrumRamp(count: number): string[] {
	if (count < 1) {
		return [];
	}
	const spans = SPECTRUM_STOPS.length - 1;
	return Array.from({ length: count }, (_, index) => {
		const position = ((index + 0.5) / count) * spans;
		const from = Math.min(Math.floor(position), spans - 1);
		return mixHex(
			SPECTRUM_STOPS[from],
			SPECTRUM_STOPS[from + 1],
			position - from,
		);
	});
}

function mixHex(from: string, to: string, t: number): string {
	const a = channels(from);
	const b = channels(to);
	const lerp = (index: number) =>
		Math.round(a[index] + (b[index] - a[index]) * t);
	return `#${hex(lerp(0))}${hex(lerp(1))}${hex(lerp(2))}`;
}

function channels(value: string): [number, number, number] {
	const int = Number.parseInt(value.slice(1), 16);
	return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function hex(value: number): string {
	return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}
