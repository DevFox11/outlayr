import { DropdownMenu, DropdownMenuItem, Text as ComposeText } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, width } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { View } from "react-native";

import { MaterialHost } from "@/components/material-host";
import { Text } from "@/components/text";
import { SANS_BY_WEIGHT } from "@/theme/body-fonts";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { OutlinedDropdownFieldProps } from "./outlined-dropdown-field";
import { OutlinedSelectField } from "./outlined-field";

export type { DropdownOption, OutlinedDropdownFieldProps } from "./outlined-dropdown-field";

/**
 * A short list picked from a Material dropdown menu that drops from the
 * field's bottom edge, the Android form of a SwiftUI menu-style `Picker`.
 * The menu's Compose host is a one-point strip along that edge: it anchors
 * the popup without sizing the field to the menu's trigger. Compose keeps a
 * menu 48dp clear of the window's edges, so near the bottom of a sheet it
 * opens upward over the field instead.
 */
export function OutlinedDropdownField<T extends string>({
    label,
    options,
    value,
    onChange,
    ground,
}: OutlinedDropdownFieldProps<T>) {
    const m3 = useMaterialColors();
    const [expanded, setExpanded] = useState(false);
    // The menu is as wide as the field, as an exposed dropdown is.
    const [fieldWidth, setFieldWidth] = useState(0);
    const selected = options.find((option) => option.value === value);

    return (
        <View onLayout={(event) => setFieldWidth(event.nativeEvent.layout.width)}>
            <OutlinedSelectField
                accessibilityValue={selected?.label ?? ""}
                focused={expanded}
                ground={ground}
                label={label}
                onPress={() => setExpanded(true)}
                value={
                    <Text className="text-body font-sans" numberOfLines={1} style={{ color: m3.onSurface }}>
                        {selected?.label}
                    </Text>
                }
            />
            <MaterialHost
                pointerEvents="none"
                style={{ bottom: 0, height: 1, left: 0, position: "absolute", right: 0 }}
            >
                <DropdownMenu
                    color={m3.surfaceContainer}
                    expanded={expanded}
                    modifiers={[fillMaxWidth()]}
                    onDismissRequest={() => setExpanded(false)}
                >
                    <DropdownMenu.Items>
                        {options.map((option) => (
                            <DropdownMenuItem
                                elementColors={{ textColor: option.value === value ? m3.primary : m3.onSurface }}
                                key={option.value}
                                modifiers={fieldWidth > 0 ? [width(fieldWidth)] : undefined}
                                onClick={() => {
                                    setExpanded(false);
                                    onChange(option.value);
                                }}
                            >
                                <DropdownMenuItem.Text>
                                    <ComposeText style={{ fontFamily: SANS_BY_WEIGHT[400], fontSize: 16 }}>
                                        {option.label}
                                    </ComposeText>
                                </DropdownMenuItem.Text>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenu.Items>
                </DropdownMenu>
            </MaterialHost>
        </View>
    );
}
