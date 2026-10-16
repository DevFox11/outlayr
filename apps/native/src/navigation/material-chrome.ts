import type { NativeStackNavigationOptions } from "expo-router";
import { useMemo } from "react";

import type { MaterialRoleColors } from "@/theme/material-roles";
import { useMaterialColors } from "@/theme/use-material-colors";

/**
 * Material 3 chrome shared by the Android navigation siblings: the small top
 * app bar, the navigation bar labels, and the bottom sheet's metrics.
 *
 * Platform-neutral on purpose. A `.android.ts` file type-checks its imports
 * against the plain sibling, so anything two Android files share has to live
 * in a module with no platform twin. Nothing on iOS imports this.
 */

/** M3 `titleLarge`: 22/28, regular. B sets app bar titles in the body face, not serif. */
export const APP_BAR_TITLE_FONT = "GoogleSansFlex_400Regular";
export const APP_BAR_TITLE_SIZE = 22;

/** M3 `labelMedium` for the navigation bar: 12/16, medium. */
export const NAV_LABEL_FONT = "GoogleSansFlex_500Medium";
export const NAV_LABEL_SIZE = 12;

/** M3 modal bottom sheet: 28dp top corners. */
export const SHEET_CORNER_RADIUS = 28;
/** Drag handle (32x4) with Compose's 22dp above and below it. */
export const SHEET_HANDLE_BAND = 48;
/** The close / title / actions row under the handle. */
export const SHEET_HEADER_ROW = 56;
/** Everything `SheetHeader` draws above a sheet's own content. */
export const SHEET_HEADER_HEIGHT = SHEET_HANDLE_BAND + SHEET_HEADER_ROW;

/**
 * The opaque small top app bar: `surface` behind a start-aligned sans title,
 * no shadow, and the navigation icon in `onSurface`. Opaque matters beyond the
 * look: a transparent header on Android drops the scrolling behaviour, so
 * content starts under the bar instead of below it.
 */
export function appBarOptions(m3: MaterialRoleColors): NativeStackNavigationOptions {
    return {
        headerLargeTitle: false,
        headerShadowVisible: false,
        headerShown: true,
        headerStyle: { backgroundColor: m3.surface },
        headerTintColor: m3.onSurface,
        headerTitleAlign: "left",
        headerTitleStyle: appBarTitleStyle(m3),
        headerTransparent: false,
    };
}

export function appBarTitleStyle(m3: MaterialRoleColors) {
    return { color: m3.onSurface, fontFamily: APP_BAR_TITLE_FONT, fontSize: APP_BAR_TITLE_SIZE };
}

/** `appBarOptions` for the current scheme, stable until a colour changes. */
export function useAppBarOptions(): NativeStackNavigationOptions {
    const m3 = useMaterialColors();
    return useMemo(() => appBarOptions(m3), [m3]);
}
