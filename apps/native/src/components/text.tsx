import type { ComponentRef, Ref } from "react";
import { Text as RNText, StyleSheet } from "react-native";
import type { TextProps, TextStyle } from "react-native";

const FAMILY = {
    bold: "SFProRounded-Bold",
    medium: "SFProRounded-Medium",
    regular: "SFProRounded-Regular",
    semibold: "SFProRounded-Semibold",
} as const;

/**
 * `fontWeight` is declared as a numeric scale plus the two names that stand for
 * points on it, so both spellings resolve to the same axis. A name RN accepts
 * but this does not map — "semibold", "heavy" — falls back to regular, which is
 * what the family table below would have picked for it anyway.
 */
function toNumericWeight(weight: TextStyle["fontWeight"]): number {
    if (weight === "bold") {
        return 700;
    }
    if (weight == null || weight === "normal") {
        return 400;
    }
    const parsed = Number(weight);
    return Number.isFinite(parsed) ? parsed : 400;
}

function roundedFamily(weight: TextStyle["fontWeight"]): string {
    const value = toNumericWeight(weight);
    if (value >= 700) {
        return FAMILY.bold;
    }
    if (value >= 600) {
        return FAMILY.semibold;
    }
    if (value >= 500) {
        return FAMILY.medium;
    }
    return FAMILY.regular;
}

type ThemedTextProps = TextProps & {
    className?: string;
    ref?: Ref<ComponentRef<typeof RNText>>;
};

/**
 * Matches any `font-*` family utility — `font-sans`, `font-sans-semibold`,
 * `font-mono`, `font-mono-medium`. Deliberately not a plain `includes`, so a
 * class like `font-bold` (a weight, not a family) still lets the mapping below
 * pick the face.
 */
const FAMILY_CLASS = /(^|\s)font-(sans|mono)(-\w+)?(\s|$)/;

/**
 * `Text` in SF Pro Rounded — the RN counterpart to SwiftUI's
 * `.system(design: .rounded)`. Static rounded faces don't synthesize weight, so
 * the node's `fontWeight` is mapped to the matching named face.
 *
 * Any caller that names a family opts out untouched — via `style.fontFamily`, or
 * via a `font-*` class. That second case matters: the injected family is applied
 * as an inline style, and inline style beats className in React Native, so
 * without this check a node styled `font-sans-semibold` would silently render
 * Regular. The token layer in `global.css` maps those classes to the same four
 * named faces, so both paths agree.
 */
export function Text({ style, className, ref, ...rest }: ThemedTextProps) {
    // SAFETY: `style` is this component's own `TextStyle` prop; RN types
    // `flatten` against the wider ViewStyle union for all callers.
    const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
    const keepFamily = flattened?.fontFamily != null || FAMILY_CLASS.test(className ?? "");
    const fontFamily = keepFamily ? undefined : roundedFamily(flattened?.fontWeight);
    return <RNText className={className} ref={ref} style={fontFamily ? [style, { fontFamily }] : style} {...rest} />;
}
