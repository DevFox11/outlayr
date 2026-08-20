import { useEffect } from "react";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";

import { SENTENCE_WASH } from "./sentence-motion";

/** How far past the word the wash reaches, matching the design's padding. */
const BLEED = 5;

/**
 * Trimmed off the 38pt line box so the wash hugs the glyphs instead of the
 * leading. Measured against SF Pro Rounded at 26pt, like {@link
 * import("./sentence-value").SentenceValue}'s rule: full-height it reads as a
 * slab behind the word rather than a highlight on it.
 */
const LEAD_TOP = 5;
const LEAD_BOTTOM = 2;

const ALPHA = 0.13;

const RADIUS = 7;

interface SentenceWashProps {
    active?: boolean;
}

/**
 * The vermilion behind whichever slot the stage below the sentence is editing.
 *
 * Bled outwards from an absolute box rather than padded onto the word: padding
 * is a width, and the sentence lives inside `RNHostView`, which re-measures the
 * whole SwiftUI form every time one of its words changes size. Only `opacity`
 * animates, for the same reason.
 *
 * The alpha is mixed here rather than written as `bg-tint/13` — uniwind compiles
 * that modifier to `color-mix(in srgb, unset 13%, transparent)` and rejects it at
 * runtime, which is the same reason `--rail-over` is a declared literal.
 */
export function SentenceWash({ active }: SentenceWashProps) {
    const colors = useColors();
    const reduced = useReducedMotion();
    const shown = useSharedValue(active ? 1 : 0);

    useEffect(() => {
        const next = active ? 1 : 0;
        shown.set(reduced ? next : withTiming(next, SENTENCE_WASH));
    }, [active, reduced, shown]);

    const washStyle = useAnimatedStyle(() => ({ opacity: shown.get() }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    backgroundColor: withAlpha(colors.tint, ALPHA),
                    borderRadius: RADIUS,
                    bottom: LEAD_BOTTOM,
                    left: -BLEED,
                    position: "absolute",
                    right: -BLEED,
                    top: LEAD_TOP,
                },
                washStyle,
            ]}
        />
    );
}
