import { useContext } from "react";
import {
	AccessibilityInfo,
	ActivityIndicator,
	Pressable,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Text } from "@/components/text";
import { StripContext, StripPositionContext } from "./context";
import { isInteractive, itemFrame } from "./geometry";

/**
 * A single animated component so the strip's geometry (`style`) and its
 * interaction/accessibility props (`pointerEvents`, `accessibilityState`,
 * ...) live on the one element tests query — the reference splits these
 * across a wrapper `Animated.View` and an inner `Pressable`, so gating props
 * set on the wrapper never actually reach the touchable.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Opacity has two independent sources: the strip's own expand/collapse fade and
 * this. They multiply rather than override, so a disabled item still fades out
 * with its siblings instead of reappearing at 0.4 when another item expands.
 */
const DISABLED_OPACITY = 0.4;

export interface StackedActionsItemProps {
	label: string;
	/** Presence enables the two-tap confirm machine (design §3.5). */
	confirmLabel?: string;
	onPress: () => void;
	disabled?: boolean;
	busy?: boolean;
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

export function StackedActionsItem({
	label,
	confirmLabel,
	onPress,
	disabled = false,
	busy = false,
	accessibilityHint,
	testID,
	style,
}: StackedActionsItemProps) {
	const strip = useContext(StripContext);
	const position = useContext(StripPositionContext);
	if (strip === null || position === null) {
		throw new Error(
			"StackedActions.Item must be used within <StackedActions>.",
		);
	}
	const { geometryShared, expandedIndex, expandedIndexShared, setExpanded } =
		strip;
	const { index1 } = position;

	const active = expandedIndex === index1;
	const interactive =
		isInteractive(index1, expandedIndex) && !disabled && !busy;

	function handlePress() {
		if (!interactive || busy) {
			return;
		}
		if (confirmLabel === undefined) {
			onPress();
			return;
		}
		if (active) {
			setExpanded(0);
			onPress();
			return;
		}
		setExpanded(index1);
		AccessibilityInfo.announceForAccessibility(confirmLabel);
	}

	const animatedStyle = useAnimatedStyle(() => {
		const frame = itemFrame(
			geometryShared.value,
			index1,
			expandedIndexShared.value,
		);
		return {
			transform: [{ translateX: frame.translateX }],
			width: frame.width,
			opacity: frame.opacity * (disabled ? DISABLED_OPACITY : 1),
		};
	});

	const displayLabel =
		active && confirmLabel !== undefined ? confirmLabel : label;

	return (
		<AnimatedPressable
			accessibilityElementsHidden={!interactive}
			accessibilityHint={active ? "Double tap to confirm" : accessibilityHint}
			accessibilityLabel={displayLabel}
			accessibilityRole="button"
			accessibilityState={{ disabled, busy }}
			className="items-center justify-center"
			disabled={!interactive || busy}
			importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
			onPress={handlePress}
			pointerEvents={interactive ? "auto" : "none"}
			style={[animatedStyle, style]}
			testID={testID}
		>
			{busy ? (
				<ActivityIndicator />
			) : (
				<Text className="font-sans-semibold text-callout" numberOfLines={1}>
					{displayLabel}
				</Text>
			)}
		</AnimatedPressable>
	);
}
