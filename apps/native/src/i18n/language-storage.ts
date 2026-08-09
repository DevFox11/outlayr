import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

import { LANGUAGE_PREFERENCE_KEY, type LanguagePreference, resolveLanguagePreference } from "./languages";

/**
 * Split from `languages.ts` so the resolution rules stay importable under the
 * node test runner, which cannot load either native module.
 */
export async function readLanguagePreference(): Promise<LanguagePreference> {
	try {
		return resolveLanguagePreference(await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY));
	} catch {
		// A read failure must never white-screen the app on launch.
		return "system";
	}
}

export async function persistLanguagePreference(preference: LanguagePreference): Promise<void> {
	try {
		await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, preference);
	} catch (error) {
		// Best-effort: it is already applied in memory, it just won't survive a
		// restart.
		console.warn("Failed to persist language preference", error);
	}
}

/**
 * Only ever reaches the display catalog. Currency stays a stated choice made in
 * onboarding (§1.7) — deriving it from the locale is the guess that defect
 * exists to remove.
 */
export function deviceLanguageTag(): string | null {
	try {
		return getLocales()[0]?.languageTag ?? null;
	} catch {
		return null;
	}
}
