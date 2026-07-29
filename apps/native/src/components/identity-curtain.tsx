import { MeshGradientView } from "expo-mesh-gradient";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { curtainShade, withAlpha } from "@/theme/shade";

/** Mesh wash height; exported so the form can bleed it up under the nav bar. */
export const CURTAIN_HEIGHT = 260;
const HEIGHT = CURTAIN_HEIGHT;

/** A uniform 3×3 grid, the centre vertex pulled up to 0.42 for an upward bow. */
const POINTS: number[][] = [
	[0, 0],
	[0.5, 0],
	[1, 0],
	[0, 0.5],
	[0.5, 0.42],
	[1, 0.5],
	[0, 1],
	[0.5, 1],
	[1, 1],
];

/** Row-2 (middle) alpha per column, and row-3 (bottom) is fully transparent. */
const MID_ALPHA = [0.55, 0.5, 0.55];

function meshHues(shades: string[]): [string, string, string] {
	switch (shades.length) {
		case 0:
			return ["#000000", "#000000", "#000000"];
		case 1:
			return [shades[0], shades[0], shades[0]];
		case 2:
			return [shades[0], shades[0], shades[1]];
		default:
			return [shades[0], shades[1], shades[2]];
	}
}

/**
 * Background-size for each `curtainGradient` layer: full width, and only the
 * top `CURTAIN_HEIGHT`. Paired with `backgroundRepeat: "no-repeat"` this is the
 * knob for "mesh down to here, plain grouped grey below" — raise or lower
 * `CURTAIN_HEIGHT` to move the band.
 */
export const CURTAIN_LAYER_SIZE = [
	{ x: "100%", y: CURTAIN_HEIGHT },
	{ x: "100%", y: CURTAIN_HEIGHT },
	{ x: "100%", y: CURTAIN_HEIGHT },
] as const;

export function curtainGradient(hues: string[] | null, isDark: boolean) {
	if (hues == null || hues.length === 0) {
		return;
	}
	const [c0, c1, c2] = meshHues(hues.map((hue) => curtainShade(hue, isDark)));
	const bloom = (color: string, left: string) =>
		({
			type: "radial-gradient",
			shape: "ellipse",
			size: { x: "70%", y: CURTAIN_HEIGHT },
			position: { top: 0, left },
			colorStops: [
				{ color, positions: ["0%"] },
				{ color: withAlpha(color, MID_ALPHA[1]), positions: ["45%"] },
				{ color: withAlpha(color, 0), positions: ["100%"] },
			],
		}) as const;
	return [bloom(c0, "12%"), bloom(c1, "50%"), bloom(c2, "88%")];
}

interface IdentityCurtainProps {
	/** The pastelizable identity hues (hex), or null/empty when there's no identity yet. */
	hues: string[] | null;
}

/**
 * An ambient mesh-gradient wash bleeding down from the top of the form, tinted by
 * the chosen identity's hues.
 */
export function IdentityCurtain({ hues }: IdentityCurtainProps) {
	const scheme = useColorScheme();
	const isDark = scheme === "dark";
	const revealed = hues != null && hues.length > 0 ? 1 : 0;
	const progress = useSharedValue(revealed);

	useEffect(() => {
		progress.value = withTiming(revealed, {
			duration: 450,
			easing: Easing.inOut(Easing.ease),
		});
	}, [revealed, progress]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: -HEIGHT * (1 - progress.value) }],
	}));

	// Frozen, never cross-faded: mesh interpolation reads as a horizontal sweep.
	// The black fallback only ever renders under a zero opacity.
	const source = hues && hues.length > 0 ? hues : ["#000000"];
	const [c0, c1, c2] = meshHues(source.map((hue) => curtainShade(hue, isDark)));
	const colors = [
		c0,
		c1,
		c2,
		withAlpha(c0, MID_ALPHA[0]),
		withAlpha(c1, MID_ALPHA[1]),
		withAlpha(c2, MID_ALPHA[2]),
		withAlpha(c0, 0),
		withAlpha(c1, 0),
		withAlpha(c2, 0),
	];

	return (
		<Animated.View
			pointerEvents="none"
			style={[
				{ position: "absolute", top: 0, left: 0, right: 0, height: HEIGHT },
				animatedStyle,
			]}
		>
			<MeshGradientView
				style={{ flex: 1 }}
				columns={3}
				rows={3}
				points={POINTS}
				colors={colors}
				ignoresSafeArea
			/>
		</Animated.View>
	);
}
