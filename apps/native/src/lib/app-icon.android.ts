import type { AppIconControl, useAppIcon as iosUseAppIcon } from "@/lib/app-icon";

export type { AppIconControl } from "@/lib/app-icon";

/**
 * expo-alternate-app-icons reports support on Android, but the app ships no
 * activity aliases to switch between (the icon plugin is iOS-only), so every
 * change would fail. Settings and the paywall hide their icon rows on this.
 */
export const alternateIconsSupported = false;

const PRIMARY: AppIconControl = { active: null, choose: () => undefined };

export const useAppIcon: typeof iosUseAppIcon = () => PRIMARY;
