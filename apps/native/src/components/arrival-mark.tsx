import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useColors } from "@/theme/use-colors";

const DRAW = { duration: 220, easing: Easing.out(Easing.cubic) };
const HOLD_MS = 900;
const FADE = { duration: 420, easing: Easing.in(Easing.quad) };

export function ArrivalMark({ onSettled }: { onSettled: () => void }) {
    const colors = useColors();
    const focused = useIsFocused();
    const reduced = useReducedMotion();
    const drawn = useSharedValue(0);
    const opacity = useSharedValue(1);
    const started = useRef(false);

    useEffect(() => {
        if (reduced) {
            onSettled();
            return;
        }
        if (!focused || started.current) {
            return;
        }
        started.current = true;
        drawn.set(withTiming(1, DRAW));
        opacity.set(
            withSequence(
                withTiming(1, { duration: DRAW.duration }),
                withDelay(
                    HOLD_MS,
                    withTiming(0, FADE, (finished) => {
                        if (finished) {
                            scheduleOnRN(onSettled);
                        }
                    })
                )
            )
        );
    }, [drawn, focused, onSettled, opacity, reduced]);

    const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scaleY: drawn.get() }] }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    backgroundColor: colors.tint,
                    borderRadius: 2,
                    bottom: 10,
                    left: -12,
                    position: "absolute",
                    top: 10,
                    width: 3,
                },
                style,
            ]}
        />
    );
}
