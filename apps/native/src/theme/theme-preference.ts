import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TranslationKey } from "@/i18n";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCE_KEY = "outlayr.theme-preference";

/** The three choices, in the order the picker offers them. */
export const THEME_OPTIONS: readonly {
	label: TranslationKey;
	detail: TranslationKey;
	value: ThemePreference;
}[] = [
	{
		label: "settings.theme.system",
		detail: "settings.theme.systemDetail",
		value: "system",
	},
	{
		label: "settings.theme.light",
		detail: "settings.theme.lightDetail",
		value: "light",
	},
	{
		label: "settings.theme.dark",
		detail: "settings.theme.darkDetail",
		value: "dark",
	},
];

export function themeLabel(preference: ThemePreference): TranslationKey {
	return (
		THEME_OPTIONS.find((option) => option.value === preference)?.label ??
		"settings.theme.system"
	);
}

const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function resolveThemePreference(
	value: string | null | undefined,
): ThemePreference {
	if (value === "light" || value === "dark" || value === "system") {
		return value;
	}
	return DEFAULT_THEME_PREFERENCE;
}

export async function readThemePreference(): Promise<ThemePreference> {
	try {
		return resolveThemePreference(
			await AsyncStorage.getItem(THEME_PREFERENCE_KEY),
		);
	} catch {
		// A read failure must never white-screen the app on launch — fall back to
		// the system default.
		return DEFAULT_THEME_PREFERENCE;
	}
}

export async function persistThemePreference(
	preference: ThemePreference,
): Promise<void> {
	try {
		await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
	} catch (error) {
		// Persistence is best-effort: a failed write must not crash the interaction
		// that changed the theme. It is already applied in memory; it just won't
		// survive a restart.
		console.warn("Failed to persist theme preference", error);
	}
}
