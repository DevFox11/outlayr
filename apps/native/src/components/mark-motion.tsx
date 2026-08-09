import { type ReactNode, useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";

import { arrivalFrame, MARK_MOTION, settleFrame } from "@/theme/mark-motion";

const SETTLE = Easing.bezier(0.22, 1, 0.36, 1);

interface ArriveProps {
	children: ReactNode;
	delay?: number;
	distance?: number;
	duration?: number;
	style?: ViewStyle;
}

export function Arrive(props: ArriveProps) {
	return useReducedMotion() ? <View style={props.style}>{props.children}</View> : <Arriving {...props} />;
}

function Arriving({
	children,
	style,
	delay = MARK_MOTION.arrive.delay,
	duration = MARK_MOTION.arrive.duration,
	distance = MARK_MOTION.arrive.distance,
}: ArriveProps) {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(delay, withTiming(1, { duration, easing: SETTLE }));
	}, [progress, delay, duration]);

	const travel = useAnimatedStyle(() => {
		const frame = arrivalFrame(progress.value, distance);
		return {
			opacity: frame.opacity,
			transform: [{ translateY: frame.translateY }],
		};
	});

	return <Animated.View style={[style, travel]}>{children}</Animated.View>;
}

interface SettleProps {
	children: ReactNode;
	delay?: number;
	duration?: number;
	from?: number;
	style?: ViewStyle;
}

export function Settle(props: SettleProps) {
	return useReducedMotion() ? <View style={props.style}>{props.children}</View> : <Settling {...props} />;
}

function Settling({
	children,
	style,
	delay = MARK_MOTION.settle.delay,
	duration = MARK_MOTION.settle.duration,
	from = MARK_MOTION.settle.scale,
}: SettleProps) {
	const progress = useSharedValue(0);

	useEffect(() => {
		progress.value = withDelay(delay, withTiming(1, { duration, easing: SETTLE }));
	}, [progress, delay, duration]);

	const landing = useAnimatedStyle(() => {
		const frame = settleFrame(progress.value, from);
		return {
			opacity: frame.opacity,
			transform: [{ scale: frame.scale }],
		};
	});

	return <Animated.View style={[style, landing]}>{children}</Animated.View>;
}

interface FadeProps {
	children: ReactNode;
	delay?: number;
	duration?: number;
	from?: number;
	style?: ViewStyle;
	to: number;
}

export function Fade(props: FadeProps) {
	return useReducedMotion() ? (
		<View style={[props.style, { opacity: props.to }]}>{props.children}</View>
	) : (
		<Fading {...props} />
	);
}

function Fading({ children, to, from = 1, style, delay = 0, duration = MARK_MOTION.fade.duration }: FadeProps) {
	const opacity = useSharedValue(from);

	useEffect(() => {
		opacity.value = withDelay(delay, withTiming(to, { duration }));
	}, [opacity, to, delay, duration]);

	const dissolve = useAnimatedStyle(() => ({ opacity: opacity.value }));

	return <Animated.View style={[style, dissolve]}>{children}</Animated.View>;
}
