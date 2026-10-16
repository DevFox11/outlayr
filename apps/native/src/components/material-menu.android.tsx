import type { MenuAction } from "@expo/ui/community/menu";
import {
    DropdownMenu,
    DropdownMenuItem,
    HorizontalDivider,
    Icon,
    RNHostView,
    Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { ImageSourcePropType } from "react-native";

import earlierIcon from "@/assets/menu-icons/earlier.png";
import laterIcon from "@/assets/menu-icons/later.png";
import nowIcon from "@/assets/menu-icons/now.png";
import { MaterialHost } from "@/components/material-host";
import { TOOLBAR_ICON_SOURCES } from "@/components/toolbar-icon-sources";
import { withAlpha } from "@/theme/shade";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { MaterialMenuProps } from "./material-menu";

export type { MaterialMenuProps } from "./material-menu";

/**
 * The SF Symbols the app's chip menus name, as the bitmaps an Android menu row
 * can draw. A row naming anything else, or passing an image source, which no
 * chip menu does, draws no icon.
 */
const SYMBOL_ICONS = new Map<MenuAction["image"], ImageSourcePropType>([
    ["arrow.uturn.backward", nowIcon],
    ["chevron.left", earlierIcon],
    ["chevron.right", laterIcon],
]);

/** Material 3's menu item label: labelLarge, 14 on 20 in the medium weight. */
const LABEL_STYLE = { fontFamily: "GoogleSansFlex_500Medium", fontSize: 14, lineHeight: 20 } as const;

const ICON_SIZE = 24;
const PRESSED_ALPHA = 0.1;
/** Material's minimum touch target, in dp. */
const MIN_TOUCH = 48;

function actionId(action: MenuAction): string {
    return action.id ?? action.title;
}

function MenuRow({ action, onChoose }: { action: MenuAction; onChoose: (id: string) => void }) {
    const m3 = useMaterialColors();
    const icon = SYMBOL_ICONS.get(action.image);
    const selected = action.state === "on";
    return (
        <DropdownMenuItem
            elementColors={{
                leadingIconColor: m3.onSurfaceVariant,
                textColor: m3.onSurface,
                trailingIconColor: m3.primary,
            }}
            enabled={action.attributes?.disabled !== true}
            onClick={() => onChoose(actionId(action))}
        >
            <DropdownMenuItem.Text>
                <ComposeText style={LABEL_STYLE}>{action.title}</ComposeText>
            </DropdownMenuItem.Text>
            {icon ? (
                <DropdownMenuItem.LeadingIcon>
                    <Icon size={ICON_SIZE} source={icon} />
                </DropdownMenuItem.LeadingIcon>
            ) : null}
            {selected ? (
                <DropdownMenuItem.TrailingIcon>
                    <Icon size={ICON_SIZE} source={TOOLBAR_ICON_SOURCES.done} />
                </DropdownMenuItem.TrailingIcon>
            ) : null}
        </DropdownMenuItem>
    );
}

/**
 * `@expo/ui`'s community `MenuView` for Android, re-hosted in `MaterialHost`.
 * That one renders a bare `Host`, so it took the wallpaper's palette rather
 * than the in-app accent, drew in the system face, and dropped every SF Symbol
 * icon. The only nesting the app's menus use is an inline section, drawn here
 * as a divider and its rows; a section's title has no Material equivalent.
 *
 * A trigger shorter than 48dp gets a 48dp touch area: the host grows by the
 * difference and gives it back as negative margin, so nothing around it moves.
 * The menu anchors to that grown box, as Compose's own chips do.
 */
export function MaterialMenu({
    accessibilityLabel,
    accessibilityValue,
    actions,
    children,
    onPressAction,
    renderTrigger,
}: MaterialMenuProps) {
    const m3 = useMaterialColors();
    const [expanded, setExpanded] = useState(false);
    const [height, setHeight] = useState<number | null>(null);
    // Half the shortfall goes above the trigger and half below.
    const slop = height === null ? 0 : Math.max(0, (MIN_TOUCH - height) / 2);
    const choose = (id: string) => {
        setExpanded(false);
        onPressAction(id);
    };

    return (
        <MaterialHost matchContents style={{ marginVertical: -slop }}>
            <DropdownMenu color={m3.surfaceContainer} expanded={expanded} onDismissRequest={() => setExpanded(false)}>
                <DropdownMenu.Trigger>
                    <RNHostView matchContents>
                        <Pressable
                            accessibilityLabel={accessibilityLabel}
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}
                            accessibilityValue={accessibilityValue}
                            android_ripple={
                                renderTrigger ? undefined : { color: withAlpha(m3.onSurface, PRESSED_ALPHA) }
                            }
                            onPress={() => setExpanded(true)}
                            style={{ paddingVertical: slop }}
                        >
                            {({ pressed }) => (
                                <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
                                    {renderTrigger ? renderTrigger({ pressed }) : children}
                                </View>
                            )}
                        </Pressable>
                    </RNHostView>
                </DropdownMenu.Trigger>
                <DropdownMenu.Items>
                    {actions
                        .filter((action) => action.attributes?.hidden !== true)
                        .flatMap((action, index) => {
                            const rows = action.subactions?.length ? action.subactions : [action];
                            const divider =
                                index > 0 && action.subactions?.length ? (
                                    <HorizontalDivider color={m3.outlineVariant} key={`${actionId(action)}-divider`} />
                                ) : null;
                            return [
                                divider,
                                ...rows
                                    .filter((row) => row.attributes?.hidden !== true)
                                    .map((row) => <MenuRow action={row} key={actionId(row)} onChoose={choose} />),
                            ];
                        })}
                </DropdownMenu.Items>
            </DropdownMenu>
        </MaterialHost>
    );
}
