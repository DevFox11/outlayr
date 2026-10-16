import { openSettings } from "expo-linking";

/**
 * Whether the system has a language setting for Outlayr that Settings can
 * send the user to. iOS lists Language on the app's own page in Settings.
 */
export function hasSystemLanguageSettings(): boolean {
    return true;
}

/** Opens the system's language setting for Outlayr: on iOS, the app's page in Settings. */
export function openLanguageSettings(): void {
    openSettings().catch(() => undefined);
}
