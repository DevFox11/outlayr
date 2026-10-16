import { Stack } from "expo-router";
import { useMemo } from "react";

import { appBarTitleStyle } from "@/navigation/material-chrome";
import { useMaterialColors } from "@/theme/use-material-colors";

import type { ScreenHeaderProps } from "./screen-header";

/**
 * The Material 3 small top app bar: opaque `surface`, start-aligned sans title,
 * no shadow. `large` is ignored, Android has no native large title.
 *
 * The title carries its own style because page-level options replace the
 * layout's key by key: a bare `<Stack.Screen.Title>` resets `headerTitleStyle`
 * and the bar falls back to the system face.
 */
export function ScreenHeader({ title }: ScreenHeaderProps) {
    const m3 = useMaterialColors();
    // Memoized, not inline: each header piece re-registers its options when a
    // prop changes identity, and that registration re-renders this screen.
    const barStyle = useMemo(
        () => ({ backgroundColor: m3.surface, color: m3.onSurface, shadowColor: "transparent" as const }),
        [m3]
    );
    const titleStyle = useMemo(() => appBarTitleStyle(m3), [m3]);

    return (
        <>
            <Stack.Header style={barStyle} transparent={false} />
            {title === undefined ? null : <Stack.Screen.Title style={titleStyle}>{title}</Stack.Screen.Title>}
        </>
    );
}
