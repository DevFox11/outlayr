import { useEffect } from "react";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { spectrumRamp } from "@/theme/spectrum";

const STROKE = 2;
const OPACITY = 0.45;
const SPIN_MS = 14_000;
/**
 * One whole turn, so the angle the ring comes to rest at is congruent to zero.
 * Load-bearing under Reduce Motion — see {@link SpectrumRing}.
 */
const SPIN_DEG = 360;
/**
 * Arc count for the conic approximation. 36 keeps each segment at 10°, which at
 * a 2pt stroke is well below the width at which a solid-filled arc reads as a
 * band rather than a gradient.
 */
const SEGMENTS = 36;
/**
 * Angular overlap per segment. Adjacent arcs share this much so antialiased end
 * caps never leave a hairline gap on the seam — without it the ring reads as a
 * dotted circle at exactly the opacity that is supposed to make it subtle.
 */
const OVERLAP_DEG = 0.6;

interface SpectrumRingProps {
	/** Outer diameter, matching SwiftUI's `strokeBorder` (stroke sits inside). */
	size: number;
}

/**
 * The conic gradient is faked: react-native-svg has no angular gradient, so the
 * ring is 36 solid-colored arcs sampled off {@link spectrumRamp}. They are laid
 * out once and never re-render — the spin is a `transform` on the parent, so
 * every frame is a GPU-composited rotation rather than an SVG rebuild.
 *
 * Reduced motion needs no branch here, but not because Reanimated declines the
 * animation. Under the default `ReduceMotion.System` the inner `withTiming`
 * assigns its `toValue` outright and reports finished on its first frame, and
 * `withRepeat` then stops rather than looping — so the ring is parked at
 * {@link SPIN_DEG} permanently. It only *reads* as untouched because a whole
 * turn is congruent to zero: any other target angle would leave every
 * reduced-motion user staring at a ring frozen mid-rotation.
 */
export function SpectrumRing({ size }: SpectrumRingProps) {
	const spin = useSharedValue(0);

	useEffect(() => {
		spin.value = withRepeat(
			withTiming(SPIN_DEG, { duration: SPIN_MS, easing: Easing.linear }),
			-1,
			false,
		);
	}, [spin]);

	const style = useAnimatedStyle(() => ({
		transform: [{ rotate: `${spin.value}deg` }],
	}));

	const center = size / 2;
	const radius = (size - STROKE) / 2;
	const step = 360 / SEGMENTS;
	const colors = spectrumRamp(SEGMENTS);

	return (
		<Animated.View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			style={[{ position: "absolute", width: size, height: size }, style]}
		>
			<Svg height={size} width={size}>
				{colors.map((color, index) => (
					<Path
						d={arc(
							center,
							radius,
							index * step - OVERLAP_DEG,
							(index + 1) * step + OVERLAP_DEG,
						)}
						fill="none"
						// biome-ignore lint/suspicious/noArrayIndexKey: arcs are a fixed-length ramp, never reordered
						key={index}
						opacity={OPACITY}
						stroke={color}
						strokeLinecap="butt"
						strokeWidth={STROKE}
					/>
				))}
			</Svg>
		</Animated.View>
	);
}

function arc(
	center: number,
	radius: number,
	fromDeg: number,
	toDeg: number,
): string {
	const point = (deg: number) => {
		const rad = (deg * Math.PI) / 180;
		return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)];
	};
	const [x0, y0] = point(fromDeg);
	const [x1, y1] = point(toDeg);
	// Every segment is far under 180°, so the large-arc flag is always 0.
	return `M ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1}`;
}
