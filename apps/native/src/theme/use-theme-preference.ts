import { useTheme } from "panelui-native";
import { useLayoutEffect } from "react";

import { useSettingNumber } from "@/contexts/display-settings-context";

import { themePreferenceForValue } from "./theme-preference";
import type { ThemePreference } from "./theme-preference";

/**
 * Pushes the stored colour scheme into uniwind, once and on every change.
 *
 * The stored setting is the source of truth, not uniwind. Uniwind holds the
 * resolved theme in memory only, so reading the preference back off it — which
 * the settings row used to do, via `hasAdaptiveThemes` — meant "Dark" survived
 * exactly until the next launch and then silently reverted to System. Reading
 * flows one way now: setting → uniwind, never back.
 *
 * Layout effect for the same reason the accent uses one: on a cold start with
 * "Dark" stored, a passive effect paints one light frame first.
 */
export function useApplyThemePreference(): ThemePreference {
    const preference = themePreferenceForValue(useSettingNumber("colorScheme"));
    const { setTheme } = useTheme();

    useLayoutEffect(() => {
        setTheme(preference);
    }, [preference, setTheme]);

    return preference;
}
