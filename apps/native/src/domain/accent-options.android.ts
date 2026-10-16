import { isDynamicColorAvailable } from "@expo/ui/jetpack-compose";

import { defaultMaterialAccentValue, materialAccentOptions } from "./material-accent";
import type { AccentOption } from "./material-accent";

/**
 * Android's accent row: "Wallpaper" first on Android 12+, then the brand
 * accents. Wallpaper carries no swatch; see `AccentOption`. See
 * `accent-options.ts` for the iOS answer.
 */
export const ACCENT_OPTIONS: readonly AccentOption[] = materialAccentOptions(isDynamicColorAvailable);

export const DEFAULT_ACCENT_VALUE: number = defaultMaterialAccentValue(isDynamicColorAvailable);
