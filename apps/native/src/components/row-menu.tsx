import { MenuView } from "@expo/ui/community/menu";
import type { MenuAction, MenuComponentRef, NativeActionEvent } from "@expo/ui/community/menu";
import type { Ref } from "react";
import { View } from "react-native";

import type { ActionMenuItem } from "@/components/action-menu";
import { useIsDark } from "@/theme/use-is-dark";

interface RowMenuProps {
    /** Items without an `icon`: Android only draws image sources, not SF Symbols. */
    items: readonly ActionMenuItem[];
    /** How far in from the row's leading edge the menu drops down. */
    leading: number;
    /** The row opens the menu with `ref.current?.show()` from its own `onLongPress`. */
    ref: Ref<MenuComponentRef>;
}

/**
 * The community menu for a plain RN row, opened from the row's own long press.
 *
 * Unlike `ActionMenu`, the row is not the menu's trigger: on Android `MenuView`
 * hosts its trigger in Compose, which shrinks the row to its content and takes
 * it out of the swipe gesture around it. The trigger here is an empty point
 * pinned to the row's bottom edge, so the dropdown opens under the row's name.
 *
 * Android only in practice: `show()` is a no-op on iOS, whose rows use
 * `ActionMenu`'s context menu instead.
 */
export function RowMenu({ items, leading, ref }: RowMenuProps) {
    const isDark = useIsDark();
    const actions: MenuAction[] = items.map((item) => ({
        attributes: item.destructive ? { destructive: true } : undefined,
        id: item.id,
        title: item.label,
    }));

    const onPressAction = ({ nativeEvent }: NativeActionEvent) => {
        items.find((item) => item.id === nativeEvent.event)?.onPress();
    };

    return (
        <MenuView
            actions={actions}
            colorScheme={isDark ? "dark" : "light"}
            onPressAction={onPressAction}
            ref={ref}
            style={{ bottom: 0, left: leading, position: "absolute" }}
        >
            <View pointerEvents="none" style={{ height: 1, width: 1 }} />
        </MenuView>
    );
}
