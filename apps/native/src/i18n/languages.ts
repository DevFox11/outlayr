export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

/**
 * Endonyms: someone who has landed in a language they cannot read still has to
 * recognise which one they are in.
 */
const LANGUAGE_NAMES: Record<Language, string> = {
	en: "English",
	es: "Español",
};

export function languageLabel(language: Language): string {
	return LANGUAGE_NAMES[language];
}

function isLanguage(value: string): value is Language {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const TAG_SUBTAG_SEPARATOR = /[-_]/;

/** `es-419`, `es_419` and `es-MX` all resolve to the one Spanish catalog. */
export function languageFromTag(tag: string | null | undefined): Language | null {
	if (!tag) {
		return null;
	}
	const primary = tag.split(TAG_SUBTAG_SEPARATOR)[0]?.toLowerCase();
	return primary && isLanguage(primary) ? primary : null;
}

/**
 * There is no in-app language preference: iOS owns this choice per app, under
 * Settings › Outlayr › Language, and writing a second one in AsyncStorage only
 * creates a state the system pickers and the App Store listing disagree with.
 */
export function resolveLanguage(deviceTag: string | null | undefined): Language {
	return languageFromTag(deviceTag) ?? DEFAULT_LANGUAGE;
}
