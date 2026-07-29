import { CATALOGS, EN, type TranslatableKey } from "./catalog";
import { DEFAULT_LANGUAGE, type Language } from "./languages";
import { type TranslationParams, translate } from "./translate";

let current: Language = DEFAULT_LANGUAGE;

/** Kept in sync by `LanguageProvider`. */
export function setRuntimeLanguage(language: Language): void {
	current = language;
}

export function runtimeLanguage(): Language {
	return current;
}

/**
 * For the call sites React hooks cannot reach — the root error boundary, which
 * renders in place of the provider tree, and background work like notification
 * scheduling. Inside a component use `useTranslation`, which re-renders when the
 * language changes; this does not.
 */
export function translateNow(
	key: TranslatableKey,
	params?: TranslationParams,
): string {
	return translate(key, {
		catalog: CATALOGS[current] ?? EN,
		fallback: EN,
		params,
	});
}
