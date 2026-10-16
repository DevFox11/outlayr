import { Switch } from "react-native";

import { useColors } from "@/theme/use-colors";

export interface EditorSwitchProps {
    accessibilityLabel: string;
    onValueChange: (next: boolean) => void;
    value: boolean;
}

/** A budget fact that is on or off, on the income track. `editor-switch.android.tsx` is the M3 switch. */
export function EditorSwitch({ accessibilityLabel, onValueChange, value }: EditorSwitchProps) {
    const colors = useColors();
    return (
        <Switch
            accessibilityLabel={accessibilityLabel}
            onValueChange={onValueChange}
            trackColor={{ false: colors.subtle, true: colors.income }}
            value={value}
        />
    );
}
