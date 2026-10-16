import { MenuView } from "@expo/ui/community/menu";
import type { MenuAction, MenuComponentRef, NativeActionEvent } from "@expo/ui/community/menu";
import { useRef } from "react";
import { View } from "react-native";

import { ListItemFrame, ListItemIcon, ListItemText } from "@/components/list/material-list-item";
import type { PickerRowProps, PickerValue } from "@/components/list/picker-row";
import { useIsDark } from "@/theme/use-is-dark";

export type { PickerRowProps, PickerValue } from "@/components/list/picker-row";

/**
 * A two-line Material 3 list item whose supporting text is the current
 * choice. The whole row opens a dropdown menu anchored under its text, the
 * standard Android picker (Direction B). The iOS SwiftUI `Picker` has no
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
    const isDark = useIsDark();
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

    // The menu wraps the text, not the row: its Compose host sizes to its
    // content, so wrapping the row would shrink it to the text anyway, and the
    // text is where M3 anchors a list item's menu. The row already announces the
    // value, so the anchor's copy stays out of TalkBack.
    return (
        <ListItemFrame
            accessibilityLabel={selected ? `${title}, ${selected.label}` : title}
            accessibilityRole="button"
            onPress={() => menu.current?.show()}
            twoLine
        >
            <ListItemIcon icon={icon} />
            <View className="flex-1 items-start">
                <MenuView
                    actions={actions}
                    colorScheme={isDark ? "dark" : "light"}
                    onPressAction={onPressAction}
                    ref={menu}
                >
                    <View importantForAccessibility="no-hide-descendants">
                        <ListItemText attention={attention} supporting={[selected?.label, detail]} title={title} />
                    </View>
                </MenuView>
            </View>
        </ListItemFrame>
    );
}
