import { Host, isDynamicColorAvailable } from "@expo/ui/jetpack-compose";

import { useSettingNumber } from "@/contexts/display-settings-context";
import { materialSeed } from "@/domain/material-accent";
import { useMaterialRevision } from "@/theme/material-revision";
import { useIsDark } from "@/theme/use-is-dark";

import type { MaterialHostProps } from "./material-host";

export type { MaterialHostProps } from "./material-host";

/**
 * `Host` themed the way the rest of the app is: the colour scheme is the app's
 * resolved light/dark (not the handset's, which differs once Settings forces
 * one), and the palette is the wallpaper's on Android 12+ or one seeded from
 * the brand accent otherwise. The same seed feeds the RN surfaces through
 * `use-accent.android.ts`, so Compose controls and RN rows start from one
 * scheme. Compose draws it raw; the `--m3-*` tokens can differ where the
 * contrast clamp moved a role for RN text.
 *
 * Keyed on the scheme revision so a wallpaper change remounts it. Compose
 * reads the wallpaper palette only while composing and no prop here changes
 * with the wallpaper, so without the key the controls keep the old colours
 * until the app restarts. The remount drops Compose-side state (an open menu,
 * say), which only happens when the palette itself changed.
 */
export function MaterialHost(props: MaterialHostProps) {
    const isDark = useIsDark();
    const seedColor = materialSeed(useSettingNumber("accentColor"), isDynamicColorAvailable);
    const revision = useMaterialRevision();

    return <Host key={revision} {...props} colorScheme={isDark ? "dark" : "light"} seedColor={seedColor} />;
}
