import { applicationId } from "expo-application";
import { openSettings } from "expo-linking";
import { Platform } from "react-native";

import type {
    hasSystemLanguageSettings as iosHasSystemLanguageSettings,
    openLanguageSettings as iosOpenLanguageSettings,
} from "@/lib/language-settings";

/** Android 13 added per-app languages. Before it the system has nothing to pick, so the row is hidden. */
const PER_APP_LANGUAGE_API = 33;

export const hasSystemLanguageSettings: typeof iosHasSystemLanguageSettings = () =>
    Number(Platform.Version) >= PER_APP_LANGUAGE_API;

function openAppInfo(): void {
    openSettings().catch(() => undefined);
}

/**
 * Outlayr's own page under App languages. The system only registers that page
 * for an intent whose data names the package, which RN's `Linking.sendIntent`
 * can't set; without it the launch has no target at all. expo-intent-launcher
 * is required here rather than imported at the top: it loads its native module
 * on import, which a build made before it was added doesn't have, and Settings
 * would fail to load.
 */
async function openAppLanguagePage(): Promise<void> {
    if (applicationId === null) {
        throw new Error("No application id to open the language page for");
    }
    // SAFETY: untyped `require`, asserted to that module's own type.
    const { ActivityAction, startActivityAsync } =
        require("expo-intent-launcher") as typeof import("expo-intent-launcher");
    await startActivityAsync(ActivityAction.APP_LOCALE_SETTINGS, { data: `package:${applicationId}` });
}

/** A system without the page, or a build without the module, gets App info, which lists Language on Android 13+. */
export const openLanguageSettings: typeof iosOpenLanguageSettings = () => {
    openAppLanguagePage().catch(openAppInfo);
};
