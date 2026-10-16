import { ACCENTS, DEFAULT_ACCENT } from "./accent";
import type { AccentOption } from "./material-accent";

/**
 * What the Settings accent row offers and what an untouched install stores.
 * iOS offers the brand accents alone; `accent-options.android.ts` puts
 * "Wallpaper" in front of them and makes it the default on Android 12+.
 */
export const ACCENT_OPTIONS: readonly AccentOption[] = ACCENTS;

export const DEFAULT_ACCENT_VALUE: number = DEFAULT_ACCENT.value;
