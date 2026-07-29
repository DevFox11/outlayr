import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import {
	CONFETTI_FLIGHT_MS,
	type ConfettiPiece,
	confettiBurst,
} from "@/domain/confetti";
import { useColors } from "@/theme/use-colors";

const PIECE_COUNT = 36;

interface ConfettiProps {
	/** Burst box, in points — pieces launch across it and fall out the bottom. */
	width: number;
	height: number;
	/** Changing this re-seeds the burst; the same value never re-fires. */
	seed: number;
}

export function Confetti({ width, height, seed }: ConfettiProps) {
	const colors = useColors();
	const palette = useMemo(
		() => [colors.income, colors.tint, colors.warning, colors.foreground],
		[colors],
	);
	const pieces = useMemo(
		() => confettiBurst(PIECE_COUNT, palette.length, seed),
		[palette.length, seed],
	);

	return (
		<View
			pointerEvents="none"
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width,
				height,
				overflow: "hidden",
			}}
		>
			{pieces.map((piece) => (
				<Piece
					color={palette[piece.colorIndex] ?? palette[0]}
					height={height}
					key={piece.id}
					piece={piece}
					width={width}
				/>
			))}
		</View>
	);
}

function Piece({
	piece,
	color,
	width,
	height,
}: {
	piece: ConfettiPiece;
	color: string;
	width: number;
	height: number;
}) {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(
			piece.delayMs,
			withTiming(1, {
				duration: piece.durationMs,
				easing: Easing.out(Easing.quad),
			}),
		);
	}, [progress, piece.delayMs, piece.durationMs]);

	const style = useAnimatedStyle(() => {
		const p = progress.value;
		return {
			opacity: interpolate(p, [0, 0.06, 0.75, 1], [0, 1, 1, 0]),
			transform: [
				{ translateX: p * piece.drift * width },
				{
					translateY: interpolate(
						p,
						[0, 0.32, 1],
						[0, -piece.rise * height, piece.fall * height],
					),
				},
				{ rotate: `${p * piece.spin}deg` },
			],
		};
	});

	return (
		<Animated.View
			style={[
				{
					position: "absolute",
					left: piece.x * width,
					// Launched from the floor of the box: the burst reads as thrown up
					// from the row the user just committed, not rained down on it.
					top: height,
					width: piece.size,
					height: piece.size * 0.6,
					borderRadius: 1,
					backgroundColor: color,
				},
				style,
			]}
		/>
	);
}

export { CONFETTI_FLIGHT_MS };
