import { useMemo } from "react";
import { useCSSVariable } from "uniwind";

import { MATERIAL_ROLE_VARIABLES, MATERIAL_ROLES } from "./material-roles";
import type { MaterialRoleColors } from "./material-roles";

const VARIABLE_NAMES = MATERIAL_ROLES.map((role) => MATERIAL_ROLE_VARIABLES[role]);

/**
 * The current Material 3 role colours as `#rrggbb` strings, for the places a
 * className cannot reach: Compose `colors=` props, Skia, svg, `withAlpha`.
 *
 * Reads the same `--m3-*` variables the `bg-m3-*` utilities do, so it follows
 * the resolved light/dark theme and, on Android, every rewrite the dynamic
 * colour pipeline makes (wallpaper change, accent change). On iOS it returns
 * the brand tokens `global.css` maps each role onto.
 *
 * Not `@expo/ui`'s hook of the same name: that one asks the native module for
 * a fresh palette, which on Android 12+ is the raw wallpaper scheme, before
 * this app's contrast clamp and without the iOS answers.
 */
export function useMaterialColors(): MaterialRoleColors {
    const values = useCSSVariable(VARIABLE_NAMES);

    return useMemo(
        // SAFETY: `fromEntries` loses the key union, and `values` is uniwind's read
        // of the same names in the same order — one slot per role.
        () =>
            Object.fromEntries(
                MATERIAL_ROLES.map((role, index) => [role, values[index] as string])
            ) as MaterialRoleColors,
        [values]
    );
}
