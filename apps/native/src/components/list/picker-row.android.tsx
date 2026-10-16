import { MenuView } from "@expo/ui/community/menu";
import type { MenuAction, MenuComponentRef, NativeActionEvent } from "@expo/ui/community/menu";
import ArrowDown01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowDown01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRef } from "react";
import { Pressable, View } from "react-native";

import type { PickerRowProps, PickerValue } from "@/components/list/picker-row";
import { RowShell } from "@/components/list/row-shell";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useColors } from "@/theme/use-colors";

export type { PickerRowProps, PickerValue } from "@/components/list/picker-row";

/**
 * The row shows the current choice and the whole row opens a Material dropdown
 * anchored at it, the standard Android picker. The iOS SwiftUI `Picker` has no
 * Android view, and mounting it is a fatal Fabric crash.
 *
 * Swatches are dropped: a dropdown item only takes an image source for its icon.
 */
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
    const menu = useRef<MenuComponentRef>(null);
    const selected = options.find((option) => option.value === value);

    const actions: MenuAction[] = options.map((option) => ({
        id: String(option.value),
        state: option.value === value ? "on" : "off",
        title: option.label,
    }));

    const onPressAction = ({ nativeEvent }: NativeActionEvent) => {
        const picked = options.find((option) => String(option.value) === nativeEvent.event);
        if (picked) {
            onChange(picked.value);
        }
    };

    // The anchor is only the current value, not the row: the menu's Compose host
    // sizes to its content, so wrapping the row would shrink it to its text. The
    // row already announces the value, so the anchor's copy stays out of TalkBack.
    const trigger = (
        <MenuView actions={actions} onPressAction={onPressAction} ref={menu}>
            <View className="flex-row items-center gap-1" importantForAccessibility="no-hide-descendants">
                <Text className={cn("text-body", attention ? "text-danger" : "text-muted")} numberOfLines={1}>
                    {selected?.label}
                </Text>
                <HugeiconsIcon
                    color={attention ? colors.danger : colors.subtle}
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={2.2}
                />
            </View>
        </MenuView>
    );

    return (
        <Pressable
            accessibilityLabel={selected ? `${title}, ${selected.label}` : title}
            accessibilityRole="button"
            className="active:opacity-60"
            onPress={() => menu.current?.show()}
        >
            <RowShell below={stacked ? trigger : undefined} detail={detail} icon={icon} title={title}>
                {stacked ? null : trigger}
            </RowShell>
        </Pressable>
    );
}
