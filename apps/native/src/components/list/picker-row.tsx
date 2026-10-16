import { Host, Text as NativeText, Picker } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";

import { RowShell } from "@/components/list/row-shell";
import type { SettingsIconName } from "@/components/settings/settings-icons";
import { TintedLabel, tintedLabelAvailable } from "@/components/settings/tinted-label";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useColors } from "@/theme/use-colors";

export type PickerValue = string | number | boolean;

export interface PickerRowProps<T extends PickerValue> {
    attention?: boolean;
    icon: SettingsIconName;
    title: string;
    detail?: string;
    options: readonly { label: string; swatch?: string; value: T }[];
    value: T;
    onChange: (value: T) => void;
}

export function PickerRow<T extends PickerValue>({
    attention = false,
    icon,
    title,
    detail,
    options,
    value,
    onChange,
}: PickerRowProps<T>) {
    const colors = useColors();
    const stacked = useAccessibilityTextSize();
    const picker = (
        <Host matchContents>
            <Picker
                modifiers={[pickerStyle("menu"), tint(attention ? colors.danger : colors.muted)]}
                onSelectionChange={(next) => {
                    const picked = options.find((option) => String(option.value) === next);
                    if (picked) {
                        onChange(picked.value);
                    }
                }}
                selection={String(value)}
            >
                {options.map((option) => {
                    const key = String(option.value);
                    if (tintedLabelAvailable && option.swatch) {
                        return (
                            <TintedLabel color={option.swatch} key={key} modifiers={[tag(key)]} title={option.label} />
                        );
                    }
                    return (
                        <NativeText key={key} modifiers={[tag(key)]}>
                            {option.label}
                        </NativeText>
                    );
                })}
            </Picker>
        </Host>
    );
    return (
        <RowShell below={stacked ? picker : undefined} detail={detail} icon={icon} title={title}>
            {stacked ? null : picker}
        </RowShell>
    );
}
