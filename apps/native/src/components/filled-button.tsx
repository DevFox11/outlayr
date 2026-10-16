import { Pressable } from "react-native";

import { BusyText } from "@/components/busy-text";
import { Text } from "@/components/text";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

export interface FilledButtonProps {
    /** This button's own work is running: its label gives way to `busyLabel`. */
    busy?: boolean;
    busyLabel?: string;
    /** Inert. Dimmed too, unless it is inert because it is the one busy. */
    disabled?: boolean;
    label: string;
    onPress: () => void;
    testID?: string;
}

/**
 * The M3 filled button: `primary`, full width, 56dp, a medium-weight label.
 * The primary action of an Android screen (Direction B's filled CTA).
 *
 * Android only, but a plain filename so several `.android.tsx` siblings can
 * share it; see `list/material-list-item.tsx`. Nothing on iOS imports it.
 */
export function FilledButton({ busy = false, busyLabel, disabled = false, label, onPress, testID }: FilledButtonProps) {
    const m3 = useMaterialColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled }}
            android_ripple={{ color: withAlpha(m3.onPrimary, 0.12) }}
            className="bg-m3-primary h-14 items-center justify-center overflow-hidden rounded-full px-6"
            disabled={disabled}
            onPress={onPress}
            style={disabled && !busy ? { opacity: 0.38 } : undefined}
            testID={testID}
        >
            {busy ? (
                <BusyText className="font-sans-medium text-body" color={m3.onPrimary}>
                    {busyLabel ?? label}
                </BusyText>
            ) : (
                <Text className="font-sans-medium text-body text-m3-on-primary">{label}</Text>
            )}
        </Pressable>
    );
}
