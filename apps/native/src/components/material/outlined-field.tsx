import ArrowDown01Icon from "@hugeicons-pro/core-solid-rounded/ArrowDown01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useEffect, useState } from "react";
import type { ComponentProps, ReactNode, Ref } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import type { TextInput as RNTextInput, TextInputInstance } from "react-native";

import { Text, TextInput } from "@/components/text";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

/**
 * Material 3 outlined text fields, drawn in RN for the Android editors: a
 * Compose `OutlinedTextField` keeps its text in a native state object, and RN's
 * `TextInput` already does focus, the keyboard and TalkBack the way the rest of
 * the form expects.
 *
 * Platform-neutral on purpose (an `.android.tsx` type-checks its imports
 * against the plain sibling), but only Android siblings render these.
 */

const FIELD_HEIGHT = 56;
const CORNER = 4;
/** The floated label is `bodySmall` (16dp line) centred on the top edge. */
const LABEL_LINE = 16;
const PRESSED_ALPHA = 0.1;

interface FieldFrameProps {
    label: string;
    /** The label sits on the outline (populated or focused) instead of inside the field. */
    floated: boolean;
    focused?: boolean;
    error?: boolean;
    /** Under the field: help text, or the error when `error` is set. */
    supportingText?: string | null;
    /** What the label's notch is cut out of: the ground the field sits on. */
    ground?: string;
    children: ReactNode;
}

/** The outline, the notched label and the supporting line. The box itself is `children`. */
function FieldFrame({
    label,
    floated,
    focused = false,
    error = false,
    supportingText,
    ground,
    children,
}: FieldFrameProps) {
    const m3 = useMaterialColors();
    const accent = error ? m3.error : m3.primary;
    // An error appears under a field the cursor may not be on, so TalkBack is
    // told; the line itself is the input's hint, read when the field is reached.
    const errorText = error ? supportingText : null;
    useEffect(() => {
        if (errorText) {
            AccessibilityInfo.announceForAccessibility(errorText);
        }
    }, [errorText]);
    let labelColor = m3.onSurfaceVariant;
    if (error || focused) {
        labelColor = accent;
    }
    return (
        <View style={{ paddingTop: LABEL_LINE / 2 }}>
            {children}
            {floated ? (
                <Text
                    className="text-label"
                    importantForAccessibility="no"
                    numberOfLines={1}
                    style={{
                        backgroundColor: ground ?? m3.surfaceContainerLow,
                        color: labelColor,
                        left: 12,
                        lineHeight: LABEL_LINE,
                        paddingHorizontal: 4,
                        position: "absolute",
                        top: 0,
                    }}
                >
                    {label}
                </Text>
            ) : null}
            {supportingText ? (
                <Text
                    className="text-label px-4 pt-1"
                    importantForAccessibility="no"
                    style={{ color: error ? m3.error : m3.onSurfaceVariant }}
                >
                    {supportingText}
                </Text>
            ) : null}
        </View>
    );
}

function useOutline(focused: boolean, error: boolean) {
    const m3 = useMaterialColors();
    const width = focused || error ? 2 : 1;
    let color = m3.outline;
    if (error) {
        color = m3.error;
    } else if (focused) {
        color = m3.primary;
    }
    return {
        borderColor: color,
        borderRadius: CORNER,
        borderWidth: width,
        minHeight: FIELD_HEIGHT,
        // The thicker focused outline grows inward, so the content keeps its place.
        paddingHorizontal: 16 - width,
    };
}

type OutlinedTextFieldProps = Omit<ComponentProps<typeof RNTextInput>, "style" | "placeholderTextColor"> & {
    label: string;
    error?: boolean;
    supportingText?: string | null;
    ground?: string;
    ref?: Ref<TextInputInstance>;
};

/**
 * An editable outlined field. The label rests inside while the field is empty
 * and unfocused, and floats onto the outline otherwise; the placeholder shows
 * only once it has floated, as in M3.
 */
export function OutlinedTextField({
    label,
    error = false,
    supportingText,
    ground,
    value,
    placeholder,
    onFocus,
    onBlur,
    ref,
    ...input
}: OutlinedTextFieldProps) {
    const m3 = useMaterialColors();
    const [focused, setFocused] = useState(false);
    const floated = focused || (value ?? "") !== "";
    const outline = useOutline(focused, error);

    return (
        <FieldFrame
            error={error}
            floated={floated}
            focused={focused}
            ground={ground}
            label={label}
            supportingText={supportingText}
        >
            <View className="flex-row items-center" style={outline}>
                <TextInput
                    accessibilityHint={supportingText ?? undefined}
                    accessibilityLabel={label}
                    className="text-body flex-1 font-sans"
                    cursorColor={error ? m3.error : m3.primary}
                    onBlur={(event) => {
                        setFocused(false);
                        onBlur?.(event);
                    }}
                    onFocus={(event) => {
                        setFocused(true);
                        onFocus?.(event);
                    }}
                    placeholder={floated ? placeholder : undefined}
                    placeholderTextColor={m3.onSurfaceVariant}
                    ref={ref}
                    selectionColor={withAlpha(m3.primary, 0.4)}
                    selectionHandleColor={m3.primary}
                    style={{ color: m3.onSurface, height: FIELD_HEIGHT - 2, paddingVertical: 0 }}
                    value={value}
                    {...input}
                />
            </View>
            {floated ? null : (
                <Text
                    className="text-body"
                    importantForAccessibility="no"
                    pointerEvents="none"
                    style={{
                        color: error ? m3.error : m3.onSurfaceVariant,
                        left: 16,
                        lineHeight: FIELD_HEIGHT,
                        position: "absolute",
                        top: LABEL_LINE / 2,
                    }}
                >
                    {label}
                </Text>
            )}
        </FieldFrame>
    );
}

interface OutlinedSelectFieldProps {
    label: string;
    /** What the field reads. The whole field is the button. */
    value: ReactNode;
    /** Spoken after the label. */
    accessibilityValue: string;
    onPress: () => void;
    /** A control at the start of the box, outside the field's own press target. */
    leading?: ReactNode;
    /** Draws the dropdown arrow at the end; off for a field that opens a sheet of its own. */
    dropdown?: boolean;
    focused?: boolean;
    ground?: string;
    accessibilityHint?: string;
}

/**
 * A read-only outlined field that opens a menu or a picker sheet when pressed,
 * M3's exposed-dropdown anatomy: the label always floats, and the value reads
 * where text would be typed.
 */
export function OutlinedSelectField({
    label,
    value,
    accessibilityValue,
    accessibilityHint,
    onPress,
    leading,
    dropdown = true,
    focused = false,
    ground,
}: OutlinedSelectFieldProps) {
    const m3 = useMaterialColors();
    const outline = useOutline(focused, false);
    return (
        <FieldFrame floated focused={focused} ground={ground} label={label}>
            <View className="flex-row items-center overflow-hidden" style={{ ...outline, paddingHorizontal: 0 }}>
                {leading}
                <Pressable
                    accessibilityHint={accessibilityHint}
                    accessibilityLabel={`${label}, ${accessibilityValue}`}
                    accessibilityRole="button"
                    android_ripple={{ color: withAlpha(m3.onSurface, PRESSED_ALPHA) }}
                    className="flex-1 flex-row items-center self-stretch"
                    onPress={onPress}
                    style={{ paddingLeft: leading ? 0 : outline.paddingHorizontal, paddingRight: 12 }}
                >
                    <View className="flex-1" importantForAccessibility="no-hide-descendants">
                        {value}
                    </View>
                    {dropdown ? <HugeiconsIcon color={m3.onSurfaceVariant} icon={ArrowDown01Icon} size={20} /> : null}
                </Pressable>
            </View>
        </FieldFrame>
    );
}
