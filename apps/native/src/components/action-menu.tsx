import { MenuView } from "@expo/ui/community/menu";
import type { MenuAction, NativeActionEvent } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * An SF Symbol name. The only icon a native menu row can draw: SwiftUI builds
 * its items through the system menu UI, which takes a symbol name and ignores an
 * image source, so the app's Hugeicons cannot reach one.
 */
export type ActionMenuSymbol = Extract<MenuAction["image"], string>;

export interface ActionMenuItem {
    /** Draws the row red and marks it destructive to VoiceOver. */
    destructive?: boolean;
    icon?: ActionMenuSymbol;
    /** Unique within one menu: it is the identifier the native event carries back. */
    id: string;
    label: string;
    onPress: () => void;
}

interface ActionMenuProps {
    /** The row itself. Long-pressing it lifts it into the menu's preview. */
    children: ReactNode;
    items: readonly ActionMenuItem[];
    style?: StyleProp<ViewStyle>;
}

/**
 * A native long-press context menu around a row.
 *
 * `MenuView` with `shouldOpenOnLongPress` is `@expo/ui/swift-ui`'s `ContextMenu`
 * with the hosting already solved: it wraps the trigger in `Host` + `RNHostView`
 * itself, which is what the bare `ContextMenu` leaves to the caller and what made
 * a per-row `Host` sit as its own inset card — see `currency-picker-row`.
 *
 * Items carry their own handler rather than an id the caller switches on, so a
 * menu cannot drift out of sync with the table that dispatches it.
 */
export function ActionMenu({ items, children, style }: ActionMenuProps) {
    // An empty menu still swallows the long press, which reads as a dead row
    // rather than a row that offers nothing.
    if (items.length === 0) {
        return children;
    }

    const actions: MenuAction[] = items.map((item) => ({
        attributes: item.destructive ? { destructive: true } : undefined,
        id: item.id,
        image: item.icon,
        title: item.label,
    }));

    const onPressAction = ({ nativeEvent }: NativeActionEvent) => {
        items.find((item) => item.id === nativeEvent.event)?.onPress();
    };

    return (
        <MenuView actions={actions} onPressAction={onPressAction} shouldOpenOnLongPress style={style}>
            {children}
        </MenuView>
    );
}
