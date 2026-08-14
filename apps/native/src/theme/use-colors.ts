import { useMemo } from "react";
import { useCSSVariable } from "uniwind";

/*
 * There used to be a `SYSTEM_COLORS` export here: `systemGroupedBackground` and
 * `secondarySystemGroupedBackground` via `PlatformColor`, used as the grounds of
 * the three grouped-form screens. The OS resolves those to its own greys, which
 * was invisible while the app's own ground was #ffffff and is the loudest thing
 * on the screen now that it is paper. They are `--grouped-background` and
 * `--surface` instead, which the same screens' siblings already read.
 */

/** `global.css` is the only declaration of these — nothing here restates a value. */
const COLOR_VARIABLES = {
    accent: "--accent",
    accentForeground: "--accent-foreground",
    background: "--background",
    border: "--border",
    danger: "--danger",
    expense: "--expense",
    foreground: "--foreground",
    future: "--future",
    groupedBackground: "--grouped-background",
    income: "--income",
    muted: "--muted",
    overBudget: "--over-budget",
    /**
     * The wash behind a bar or rail. Declared as an `rgba()` rather than a hex,
     * so unlike its neighbours it is not safe to hand to `withAlpha` — it is here
     * for the charts that need the track as a string instead of a class.
     */
    railTrack: "--rail-track",
    separator: "--separator",
    subtle: "--subtle",
    surface: "--surface",
    surfaceSecondary: "--surface-secondary",
    tint: "--tint",
    transfer: "--transfer",
    warning: "--warning",
} as const;

type ColorName = keyof typeof COLOR_VARIABLES;

const COLOR_NAMES = Object.keys(COLOR_VARIABLES) as ColorName[];
const COLOR_VARIABLE_NAMES = COLOR_NAMES.map((name) => COLOR_VARIABLES[name]);

export type ThemeColors = Record<ColorName, string>;

/**
 * Concrete color strings for the semantic tokens, read out of `global.css` at
 * runtime. Needed wherever a raw color string is required rather than a uniwind
 * className — chiefly `@hugeicons/react-native` glyphs (their stroke color is an
 * SVG prop, not a style class), Skia, and computed `rgba()` washes.
 *
 * Tracks `Uniwind.setTheme` and any enclosing `ScopedTheme`, and returns `#rrggbb`
 * — uniwind resolves theme-layer variables to hex on native, so the results stay
 * safe to pass to {@link import("@/theme/shade").withAlpha}.
 */
export function useColors(): ThemeColors {
    const values = useCSSVariable(COLOR_VARIABLE_NAMES);

    return useMemo(
        () => Object.fromEntries(COLOR_NAMES.map((name, index) => [name, values[index] as string])) as ThemeColors,
        [values]
    );
}
