import type { TranslationKey } from "@/i18n/catalog";

import { ACCENTS, accentForValue, DEFAULT_ACCENT, WALLPAPER_ACCENT_VALUE } from "./accent";

/**
 * One choice in the Settings accent row: a label, the stored value, and a
 * swatch per theme when the choice has a fixed colour. "Wallpaper" has none:
 * its colour is whatever the device says at the moment it is drawn.
 */
export interface AccentOption {
    dark?: string;
    label: TranslationKey;
    light?: string;
    value: number;
}

/**
 * The seed a Material scheme is built from for the stored `accentColor`, or
 * `undefined` to follow the wallpaper.
 *
 * The brand accent's light value is enough: `SchemeTonalSpot` keeps only the
 * seed's hue and sets its own chroma and tones. Wallpaper needs Android 12, so
 * below it the reserved value seeds from the default accent like any unknown one.
 */
export function materialSeed(value: number, dynamicColor: boolean): string | undefined {
    if (value === WALLPAPER_ACCENT_VALUE && dynamicColor) {
        return undefined;
    }
    return accentForValue(value).light;
}

/**
 * The accent row on Android: "Wallpaper" first when the device has one to
 * follow, then the brand accents, which seed a scheme instead of tinting.
 */
export function materialAccentOptions(dynamicColor: boolean): readonly AccentOption[] {
    if (!dynamicColor) {
        return ACCENTS;
    }
    return [{ label: "settings.theme.wallpaper", value: WALLPAPER_ACCENT_VALUE }, ...ACCENTS];
}

/**
 * The value the accent row shows as selected: the stored one when the row
 * offers it, otherwise `fallback`. `accentColor` syncs between devices, so an
 * iPhone (or an Android phone below 12) can receive a value its row has no
 * option for, and a picker given a selection with no matching option shows
 * none at all.
 */
export function offeredAccentValue(stored: number, options: readonly AccentOption[], fallback: number): number {
    return options.some((option) => option.value === stored) ? stored : fallback;
}

/** Wallpaper is the Android default wherever it exists; the brand default elsewhere. */
export function defaultMaterialAccentValue(dynamicColor: boolean): number {
    return dynamicColor ? WALLPAPER_ACCENT_VALUE : DEFAULT_ACCENT.value;
}
