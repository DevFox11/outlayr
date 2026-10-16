import { getMaterialColors, isDynamicColorAvailable } from "@expo/ui/jetpack-compose";
import { useLayoutEffect } from "react";
import { AppState } from "react-native";
import { Uniwind } from "uniwind";

import { useSettingNumber } from "@/contexts/display-settings-context";
import { accentForValue } from "@/domain/accent";
import type { Accent } from "@/domain/accent";
import { materialSeed } from "@/domain/material-accent";

import { applyMaterialScheme } from "./material-revision";
import { MATERIAL_ROLES } from "./material-roles";
import type { MaterialRoleColors } from "./material-roles";
import { hexFromRgba, materialVariables } from "./material-scheme";
import type { MaterialTheme } from "./material-scheme";

const THEMES: readonly MaterialTheme[] = ["light", "dark"];

/** The scheme Compose paints with, for one theme, as `#rrggbb` per role. */
function composeScheme(theme: MaterialTheme, seedColor: string | undefined): MaterialRoleColors {
    const palette = getMaterialColors({ scheme: theme, seedColor });
    // SAFETY: `fromEntries` loses the key union; one entry per role.
    return Object.fromEntries(MATERIAL_ROLES.map((role) => [role, hexFromRgba(palette[role])])) as MaterialRoleColors;
}

/**
 * Android's Material You pipeline, in the slot the iOS accent hook fills.
 *
 * Reads the scheme Compose itself uses (`@expo/ui`'s `getMaterialColors`: the
 * wallpaper's on Android 12+ with "Wallpaper" chosen, otherwise TonalSpot
 * seeded from the brand accent), rebuilds every colour variable from it
 * through `materialVariables`, and writes both themes through uniwind. RN
 * surfaces and Compose controls in a `MaterialHost` start from the same scheme;
 * they differ only where the contrast clamp had to move a role for RN text.
 *
 * Re-reads when the app comes back to the foreground, which is where a
 * wallpaper change lands. `applyMaterialScheme` skips the write when the scheme
 * is the one already applied, so an ordinary resume restyles nothing, and
 * bumps the revision `MaterialHost` keys on when it does write. Light/dark
 * needs no listener: both themes are always written. A layout effect for the
 * reason the iOS hook gives: the first frame must already be in the scheme,
 * not in paper and ink.
 */
export function useAccent(): Accent {
    const value = useSettingNumber("accentColor");
    const seedColor = materialSeed(value, isDynamicColorAvailable);

    useLayoutEffect(() => {
        const apply = () => {
            const schemes = THEMES.map((theme) => composeScheme(theme, seedColor));
            applyMaterialScheme(JSON.stringify(schemes), () => {
                for (const [index, theme] of THEMES.entries()) {
                    Uniwind.updateCSSVariables(theme, materialVariables(schemes[index], theme));
                }
            });
        };
        apply();
        const appState = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                apply();
            }
        });
        return () => {
            appState.remove();
        };
    }, [seedColor]);

    return accentForValue(value);
}
