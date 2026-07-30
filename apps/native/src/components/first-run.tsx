import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";

const EASE = Easing.bezier(0.19, 1, 0.22, 1);
const FADE_MS = 200;

/** Ring diameters bleed past the screen on purpose — layers, not a target. */
const RING_SIZES = [220, 340, 480, 640] as const;
const RING_OPACITY = [1, 0.72, 0.48, 0.28] as const;
const RING_STAGGER_MS = 70;

/**
 * The cover gets the long arrival (mark settles, rings ripple, text rises);
 * every later screen replays a shorter cut of the same choreography, which is
 * what makes a route push read as the stage swapping objects rather than a new
 * page.
 */
const ENTRANCE = {
	cover: { object: 0, rings: 100, text: 220, dock: 400 },
	step: { object: 0, rings: 0, text: 60, dock: 160 },
} as const;

function useRise(active: boolean, delayMs: number, distance = 6) {
	const reduced = useReducedMotion();
	const progress = useSharedValue(active ? 0 : 1);

	useEffect(() => {
		if (!active) {
			return;
		}
		progress.value = withDelay(
			reduced ? 0 : delayMs,
			withTiming(1, { duration: reduced ? FADE_MS : 480, easing: EASE }),
		);
	}, [active, delayMs, reduced, progress]);

	return useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: reduced ? 0 : (1 - progress.value) * distance }],
	}));
}

function Ring({
	size,
	targetOpacity,
	delayMs,
}: {
	size: number;
	targetOpacity: number;
	delayMs: number;
}) {
	const reduced = useReducedMotion();
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(
			reduced ? 0 : delayMs,
			withTiming(1, { duration: reduced ? FADE_MS : 600, easing: EASE }),
		);
	}, [delayMs, reduced, progress]);

	const style = useAnimatedStyle(() => ({
		opacity: progress.value * targetOpacity,
		transform: [{ scale: reduced ? 1 : 0.85 + progress.value * 0.15 }],
	}));

	return (
		<Animated.View
			className="absolute rounded-full border border-fr-rule"
			style={[{ borderRadius: size / 2, height: size, width: size }, style]}
		/>
	);
}

/** Concentric layers radiating from the stage object — the mark's own geometry. */
function Rings({ delayMs }: { delayMs: number }) {
	return (
		<View
			className="absolute inset-0 items-center justify-center"
			pointerEvents="none"
		>
			{RING_SIZES.map((size, index) => (
				<Ring
					delayMs={delayMs + index * RING_STAGGER_MS}
					key={size}
					size={size}
					targetOpacity={RING_OPACITY[index] ?? 1}
				/>
			))}
		</View>
	);
}

function StageObject({
	children,
	cover,
}: {
	children: ReactNode;
	cover: boolean;
}) {
	const reduced = useReducedMotion();
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withTiming(1, {
			duration: reduced ? FADE_MS : cover ? 480 : 380,
			easing: EASE,
		});
	}, [cover, reduced, progress]);

	const style = useAnimatedStyle(() => {
		if (reduced) {
			return { opacity: progress.value };
		}
		// The cover's mark settles into place; a step's object arrives from a
		// touch above scale, so a push reads as the stage swapping objects.
		const scale = cover
			? 0.92 + progress.value * 0.08
			: 1.05 - progress.value * 0.05;
		return {
			opacity: progress.value,
			transform: [
				{ scale },
				{ translateY: cover ? (1 - progress.value) * 6 : 0 },
			],
		};
	});

	return <Animated.View style={style}>{children}</Animated.View>;
}

export interface FirstRunAction {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}

export interface FirstRunSkip {
	label: string;
	onPress: () => void;
}

interface FirstRunProps {
	/**
	 * The one thing the stage holds, centered over the layer-rings. Screens
	 * without one (the adoption and unconfigured states) fall back to a head-
	 * at-top layout with `children` filling the space instead.
	 */
	object?: ReactNode;
	/** The cover's longer arrival choreography. Only the first screen sets it. */
	cover?: boolean;
	eyebrow?: string;
	title: string;
	body?: string;
	/** Controls docked above the action — a picker row, the provider buttons. */
	children?: ReactNode;
	action?: FirstRunAction;
	skip?: FirstRunSkip;
	footnote?: string;
	/**
	 * Rendered in permanently reserved space: an error that pushed into flow
	 * would shift the buttons under the user's thumb at the moment it appeared.
	 */
	error?: string | null;
}

/**
 * The first-run shell: one object center-stage, one text block, one button.
 * Draws on the icon's own palette (`--fr-*`), themed per face rather than
 * inverted, so the flow commits to the paper-and-ink look on both schemes.
 */
export function FirstRun({
	object,
	cover = false,
	eyebrow,
	title,
	body,
	children,
	action,
	skip,
	footnote,
	error,
}: FirstRunProps) {
	const timing = cover ? ENTRANCE.cover : ENTRANCE.step;
	const textStyle = useRise(object !== undefined, timing.text);
	const dockStyle = useRise(object !== undefined, timing.dock, 0);

	return (
		// One top offset for every screen in the flow: the steps carry a
		// transparent OS header, so content starts below a 44pt bar, and matching
		// the cover and the gate to it keeps the stage from jumping between them.
		<View className="flex-1 bg-fr-ground px-6 pt-safe-offset-14 pb-safe-offset-5">
			{object === undefined ? (
				<>
					<View className="gap-2">
						{eyebrow ? (
							<MonoLabel className="text-fr-muted">{eyebrow}</MonoLabel>
						) : null}
						<Text className="font-sans-semibold text-fr-ink text-title">
							{title}
						</Text>
						{body ? (
							<Text className="text-fr-muted text-subtitle leading-snug">
								{body}
							</Text>
						) : null}
					</View>
					<View className="flex-1 justify-center">{children}</View>
				</>
			) : (
				<>
					<View className="flex-1 items-center justify-center">
						<Rings delayMs={timing.rings} />
						<StageObject cover={cover}>{object}</StageObject>
					</View>
					<Animated.View className="items-center gap-2.5" style={textStyle}>
						{eyebrow ? (
							<MonoLabel className="text-center text-fr-vermilion">
								{eyebrow}
							</MonoLabel>
						) : null}
						<Text className="text-center font-sans-semibold text-[28px] text-fr-ink leading-[33px] tracking-[-0.5px]">
							{title}
						</Text>
						{body ? (
							<Text className="max-w-72 text-center text-fr-muted text-subtitle leading-snug">
								{body}
							</Text>
						) : null}
					</Animated.View>
					{children ? (
						<Animated.View className="pt-5" style={dockStyle}>
							{children}
						</Animated.View>
					) : null}
				</>
			)}

			{action ? (
				<Animated.View
					className="pt-5"
					style={object === undefined ? null : dockStyle}
				>
					<Pressable
						accessibilityRole="button"
						className="items-center rounded-full bg-fr-ink px-7 py-3.5 active:opacity-80 disabled:opacity-50"
						disabled={action.disabled}
						onPress={action.onPress}
					>
						<Text className="font-sans-semibold text-body text-fr-ground">
							{action.label}
						</Text>
					</Pressable>
				</Animated.View>
			) : null}

			{skip ? (
				<Pressable accessibilityRole="button" onPress={skip.onPress}>
					<Text className="pt-3 text-center font-sans-medium text-fr-muted text-subtitle">
						{skip.label}
					</Text>
				</Pressable>
			) : null}

			{footnote ? (
				<Text className="pt-3 text-center text-footnote text-fr-muted">
					{footnote}
				</Text>
			) : null}

			{error === undefined ? null : (
				<View className="min-h-9 justify-start pt-2">
					{error ? (
						<Text
							accessibilityLiveRegion="polite"
							className="text-center text-danger text-subtitle leading-snug"
							role="alert"
						>
							{error}
						</Text>
					) : null}
				</View>
			)}
		</View>
	);
}
