import { Pressable } from "react-native";

import { BusyText } from "@/components/busy-text";
import { Text } from "@/components/text";
import { useColors } from "@/theme/use-colors";

export interface SettingsActionProps {
    /** This button's own work is running: its label gives way to `busyLabel`. */
    busy: boolean;
    busyLabel: string;
    /** Inert. Dimmed too, unless it is inert because it is the one busy. */
    disabled: boolean;
    label: string;
    onPress: () => void;
}

/** A settings screen's one primary action, in ink: Export's and Restore's. */
export function SettingsAction({ busy, busyLabel, disabled, label, onPress }: SettingsActionProps) {
    const colors = useColors();
    return (
        <Pressable
            accessibilityRole="button"
            className="bg-foreground h-14 items-center justify-center rounded-[28px] active:opacity-70"
            disabled={disabled}
            onPress={onPress}
            style={disabled && !busy ? { opacity: 0.4 } : undefined}
        >
            {busy ? (
                <BusyText className="font-sans-semibold text-callout" color={colors.background}>
                    {busyLabel}
                </BusyText>
            ) : (
                <Text className="font-sans-semibold text-background text-callout">{label}</Text>
            )}
        </Pressable>
    );
}
