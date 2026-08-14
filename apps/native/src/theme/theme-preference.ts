import type { TranslationKey } from "@/i18n/catalog";

export type ThemePreference = "light" | "dark" | "system";

/**
 * The three choices, in the order the picker offers them.
 *
 * Labelled "Color Scheme" in Settings, not "Theme": the Theme row next to it
 * picks the accent. The type keeps uniwind's word because uniwind's `theme` is
 * exactly this — light, dark, or adaptive.
 *
 * `value` is what the `colorScheme` setting stores. Numeric because
 * `SETTING_DEFAULTS` admits booleans and numbers and nothing else, so a
 * string-valued preference has no mechanism to persist through. Append only;
 * never renumber, or every device that already stored one reads back a
 * different answer.
 */
export const THEME_OPTIONS: readonly {
    label: TranslationKey;
    detail: TranslationKey;
    preference: ThemePreference;
    value: number;
}[] = [
    {
        detail: "settings.colorScheme.systemDetail",
        label: "settings.colorScheme.system",
        preference: "system",
        value: 0,
    },
    {
        detail: "settings.colorScheme.lightDetail",
        label: "settings.colorScheme.light",
        preference: "light",
        value: 1,
    },
    {
        detail: "settings.colorScheme.darkDetail",
        label: "settings.colorScheme.dark",
        preference: "dark",
        value: 2,
    },
];

const [SYSTEM_OPTION] = THEME_OPTIONS;

/** Falls back to following the device: the value comes from storage. */
export function themePreferenceForValue(value: number): ThemePreference {
    return (THEME_OPTIONS.find((option) => option.value === value) ?? SYSTEM_OPTION).preference;
}

export function valueForThemePreference(preference: ThemePreference): number {
    return (THEME_OPTIONS.find((option) => option.preference === preference) ?? SYSTEM_OPTION).value;
}
