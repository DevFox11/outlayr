import Svg, { Path } from "react-native-svg";
import { spectrumRamp } from "@/theme/spectrum";

const STROKE = 2;
const OPACITY = 0.45;
/**
 * Segment count for the conic approximation. 36 keeps each slice short enough
 * that a 2pt stroke reads as a gradient rather than a run of bands.
 */
const SEGMENTS = 36;
/**
 * Overlap in points. Adjacent slices share this much so antialiased ends never
 * leave a hairline gap on the seam — without it the outline reads as a dotted
 * border at exactly the opacity meant to make it subtle.
 */
const OVERLAP = 1.2;

interface SpectrumRingProps {
	/** Outer size, matching SwiftUI's `strokeBorder` (stroke sits inside). */
	size: number;
	/** Outer corner radius, so the outline stays concentric with the tile. */
	radius: number;
}

/**
 * The spectrum outline around an empty identity well, following the same
 * rounded square the filled well draws rather than a circle.
 *
 * The conic gradient is faked twice over: react-native-svg has no angular
 * gradient, so the outline is 36 solid-colored slices sampled off
 * {@link spectrumRamp} — and rather than 36 hand-built sub-paths, each slice is
 * the *same* rounded-rect path wearing a dash pattern that exposes only its own
 * run of the perimeter. One geometry, 36 strokes, no trigonometry at the
 * corners where a hand-rolled arc would drift out of the radius.
 */
export function SpectrumRing({ size, radius }: SpectrumRingProps) {
	const inset = STROKE / 2;
	const side = size - STROKE;
	const corner = Math.max(0, Math.min(radius - inset, side / 2));
	// Four straight runs plus the four corner quarters, which together make one
	// full circle of that radius.
	const perimeter = 4 * (side - 2 * corner) + 2 * Math.PI * corner;
	const slice = perimeter / SEGMENTS;
	const colors = spectrumRamp(SEGMENTS);

	const d = roundedRectPath(inset, inset, side, side, corner);

	return (
		<Svg
			accessibilityElementsHidden
			height={size}
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			style={{ position: "absolute" }}
			width={size}
		>
			{colors.map((color, index) => (
				<Path
					d={d}
					fill="none"
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length ramp, never reordered
					key={index}
					opacity={OPACITY}
					stroke={color}
					strokeDasharray={`${slice + OVERLAP} ${perimeter - slice - OVERLAP}`}
					strokeDashoffset={-index * slice}
					strokeLinecap="butt"
					strokeWidth={STROKE}
				/>
			))}
		</Svg>
	);
}

function roundedRectPath(
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
): string {
	const right = x + width;
	const bottom = y + height;
	return [
		`M ${x + radius} ${y}`,
		`L ${right - radius} ${y}`,
		`A ${radius} ${radius} 0 0 1 ${right} ${y + radius}`,
		`L ${right} ${bottom - radius}`,
		`A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
		`L ${x + radius} ${bottom}`,
		`A ${radius} ${radius} 0 0 1 ${x} ${bottom - radius}`,
		`L ${x} ${y + radius}`,
		`A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
		"Z",
	].join(" ");
}
