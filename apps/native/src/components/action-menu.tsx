import { MenuView } from "@expo/ui/community/menu";
import type { MenuAction, MenuComponentProps, NativeActionEvent } from "@expo/ui/community/menu";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";

/**
 * An SF Symbol name. The only icon a native menu row can draw: SwiftUI builds
 * its items through the system menu UI, which takes a symbol name and ignores an
 * image source, so the app's Hugeicons cannot reach one.
 */
type ActionMenuSymbol = Extract<MenuAction["image"], string>;

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
    /**
     * What the items act on, for a row a recycling list hands to another entry. A
     * menu still open when the owner changes then cannot act on the new one: on
     * Android it closes; on iOS, where SwiftUI keeps showing the menu it opened
     * with, the native items are rebuilt under the new owner, so a tap in that menu
     * reaches nothing.
     */
    owner?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * `MenuView` around a row that fills its parent's width.
 *
 * Since @expo/ui 57.0.15 the hosted view is a leaf measured from its children,
 * so a row inside it no longer inherits the list's width and shrinks to its
 * content. The plain outer view still stretches like any other row; its measured
 * width is handed to the host and the hosted child so they lay out at the width
 * the list gave them. Until that first measure the row renders unwrapped.
 */
export function StretchedMenuView({ children, style, ...menu }: MenuComponentProps) {
    const [width, setWidth] = useState<number | null>(null);

    const onLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0 && next !== width) {
            setWidth(next);
        }
    };

    return (
        <View onLayout={onLayout} style={[styles.stretch, style]}>
            {width === null ? (
                children
            ) : (
                <MenuView {...menu} style={{ width }}>
                    <View style={{ width }}>{children}</View>
                </MenuView>
            )}
        </View>
    );
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
export function ActionMenu({ items, owner, children, style }: ActionMenuProps) {
    // An empty menu still swallows the long press, which reads as a dead row
    // rather than a row that offers nothing.
    if (items.length === 0) {
        return children;
    }

    const actionId = (item: ActionMenuItem) => (owner === undefined ? item.id : `${owner}:${item.id}`);

    const actions: MenuAction[] = items.map((item) => ({
        attributes: item.destructive ? { destructive: true } : undefined,
        id: actionId(item),
        image: item.icon,
        title: item.label,
    }));

    const onPressAction = ({ nativeEvent }: NativeActionEvent) => {
        items.find((item) => actionId(item) === nativeEvent.event)?.onPress();
    };

    return (
        <StretchedMenuView actions={actions} onPressAction={onPressAction} shouldOpenOnLongPress style={style}>
            {children}
        </StretchedMenuView>
    );
}

const styles = StyleSheet.create({
    stretch: { alignSelf: "stretch" },
});
