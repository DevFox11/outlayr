import { createContext, use } from "react";
import type { ComponentProps, ComponentRef, Ref } from "react";
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from "react-native";
import type { TextProps, TextStyle } from "react-native";

export const ROUNDED = "ui-rounded";

type ThemedTextProps = TextProps & {
    className?: string;
    ref?: Ref<ComponentRef<typeof RNText>>;
};

/**
 * Matches any `font-*` family utility — `font-sans`, `font-sans-semibold`,
 * `font-mono`, `font-mono-medium`. Deliberately not a plain `includes`, so a
 * class like `font-bold` (a weight, not a family) still gets the rounded face.
 */
const FAMILY_CLASS = /(^|\s)font-(sans|mono)(-\w+)?(\s|$)/;

export const FontScaleCapContext = createContext<number | undefined>(undefined);

/**
 * `Text` in the system rounded face, the RN counterpart to SwiftUI's
 * `.system(design: .rounded)`. `fontWeight` applies as is.
 *
 * Any caller that names a family opts out untouched, via `style.fontFamily` or
 * a `font-*` class. That second case matters: the injected family is an inline
 * style, and inline style beats className in React Native, so without this
 * check a node styled `font-mono` would silently render rounded.
 */
export function Text({ style, className, ref, ...rest }: ThemedTextProps) {
    const fontScaleCap = use(FontScaleCapContext);
    // SAFETY: `style` is this component's own `TextStyle` prop; RN types
    // `flatten` against the wider ViewStyle union for all callers.
    const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
    const keepFamily = flattened?.fontFamily != null || FAMILY_CLASS.test(className ?? "");
    return (
        <RNText
            className={className}
            maxFontSizeMultiplier={fontScaleCap}
            ref={ref}
            style={keepFamily ? style : [style, { fontFamily: ROUNDED }]}
            {...rest}
        />
    );
}

export function TextInput(props: ComponentProps<typeof RNTextInput>) {
    return <RNTextInput maxFontSizeMultiplier={use(FontScaleCapContext)} {...props} />;
}
