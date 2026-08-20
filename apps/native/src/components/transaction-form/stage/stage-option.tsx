import type { ReactNode } from "react";
import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/text";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

const SELECT = { duration: 180 } as const;

const SELECTED_ALPHA = 0.13;

/**
 * The pill is 38pt tall against a 44pt minimum. Horizontal slop stays inside the
 * 8pt gap `StageOptionRow` lays between neighbours, so no two targets overlap.
 */
const HIT_SLOP = { bottom: 3, left: 4, right: 4, top: 3 } as const;

export interface StageOptionProps {
    /** Defaults to the visible label; give one where the label alone is ambiguous. */
    accessibilityLabel?: string;
    label: string;
    /** A dot or tile drawn before the label — a category swatch, an account glyph. */
    leading?: ReactNode;
    onPress: () => void;
    selected?: boolean;
}

/**
 * One choice on the stage. Only colour animates: these render inside a SwiftUI
 * `RNHostView`, which re-measures the whole tree whenever a child changes size.
 */
export function StageOption({ accessibilityLabel, label, leading, onPress, selected = false }: StageOptionProps) {
    const colors = useColors();
    const reduced = useReducedMotion();
    const on = useSharedValue(selected ? 1 : 0);

    // Mixed out here rather than inside the worklet: `withAlpha` is not a
    // worklet, and calling it from `useAnimatedStyle` crashes on the UI thread.
    // The resting fill is the same vermilion at zero alpha so the wash arrives
    // without travelling through grey.
    const restFill = withAlpha(colors.tint, 0);
    const selectedFill = withAlpha(colors.tint, SELECTED_ALPHA);
    const { separator, tint } = colors;

    useEffect(() => {
        const next = selected ? 1 : 0;
        on.set(reduced ? next : withTiming(next, SELECT));
    }, [on, reduced, selected]);

    const fill = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(on.get(), [0, 1], [restFill, selectedFill]),
        borderColor: interpolateColor(on.get(), [0, 1], [separator, tint]),
    }));

    return (
        <Pressable
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={HIT_SLOP}
            onPress={onPress}
        >
            <Animated.View className="h-[38px] flex-row items-center gap-2 rounded-[19px] border px-3.5" style={fill}>
                {leading}
                <Text className="text-foreground text-subtitle">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}
