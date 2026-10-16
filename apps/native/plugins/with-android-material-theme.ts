import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AndroidConfig, withAndroidStyles, withDangerousMod } from "expo/config-plugins";
import type { ConfigPlugin } from "expo/config-plugins";

/**
 * Material Components' DayNight theme with wallpaper colour on Android 12+.
 * Comes from `com.google.android.material:material`, which `@expo/ui` already
 * puts on the classpath for Compose.
 */
const MATERIAL_THEME = "Theme.Material3.DynamicColors.DayNight.NoActionBar";

const ALERT_THEME = "Theme.App.AlertDialog";
const ALERT_BACKGROUND = "m3_alert_dialog_background";

/**
 * The M3 dialog container: 28dp corners on `surfaceContainerHigh`. Material's
 * own builder draws this in code, but React Native's `Alert` goes through
 * AppCompat's, which only reads the window background, and MDC's default for
 * that is the 4dp Material 2 card.
 */
const ALERT_BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:insetLeft="24dp"
    android:insetTop="80dp"
    android:insetRight="24dp"
    android:insetBottom="80dp">
    <shape android:shape="rectangle">
        <corners android:radius="28dp" />
        <solid android:color="?attr/colorSurfaceContainerHigh" />
    </shape>
</inset>
`;

/**
 * Re-parents the Activity theme on Material 3 with dynamic colour, so the
 * views Android draws itself (`Alert.alert`, system dialogs, the community
 * date and time picker dialogs) come out in the same Material You palette as
 * the app, and follow its light/dark through `AppCompatDelegate`.
 *
 * Expo writes `Theme.AppCompat.DayNight.NoActionBar` plus a static
 * `colorPrimary`, which would pin every dialog button to one colour, so that
 * item goes too. Expo's own style mods run before this one (later plugins'
 * mods run first, and Expo's defaults are registered last).
 *
 * Below Android 12 the theme falls back to the static Material 3 baseline.
 */
const withAndroidMaterialTheme: ConfigPlugin = (config) => {
    const withBackground = withDangerousMod(config, [
        "android",
        async (dangerousConfig) => {
            const drawables = path.join(dangerousConfig.modRequest.platformProjectRoot, "app/src/main/res/drawable");
            await mkdir(drawables, { recursive: true });
            await writeFile(path.join(drawables, `${ALERT_BACKGROUND}.xml`), ALERT_BACKGROUND_XML);
            return dangerousConfig;
        },
    ]);

    return withAndroidStyles(withBackground, (stylesConfig) => {
        const appTheme = AndroidConfig.Styles.getAppThemeGroup();
        let styles = stylesConfig.modResults;
        const theme = styles.resources.style?.find((style) => style.$.name === appTheme.name);
        if (!theme) {
            throw new Error(`withAndroidMaterialTheme: no ${appTheme.name} style in styles.xml.`);
        }
        theme.$.parent = MATERIAL_THEME;
        styles = AndroidConfig.Styles.assignStylesValue(styles, {
            add: false,
            name: "colorPrimary",
            parent: appTheme,
            value: "",
        });
        styles = AndroidConfig.Styles.assignStylesValue(styles, {
            add: true,
            name: "alertDialogTheme",
            parent: appTheme,
            value: `@style/${ALERT_THEME}`,
        });
        stylesConfig.modResults = AndroidConfig.Styles.assignStylesValue(styles, {
            add: true,
            name: "android:windowBackground",
            parent: { name: ALERT_THEME, parent: "ThemeOverlay.Material3.Dialog.Alert" },
            value: `@drawable/${ALERT_BACKGROUND}`,
        });
        return stylesConfig;
    });
};

export default withAndroidMaterialTheme;
