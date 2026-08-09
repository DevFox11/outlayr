export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type LanguagePreference = Language | "system";

export const DEFAULT_LANGUAGE: Language = "en";

const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = "system";

export const LANGUAGE_PREFERENCE_KEY = "outlayr.language-preference";

/**
 * Endonyms: someone who has landed in a language they cannot read still has to
 * find their way back out of this list.
 */
const LANGUAGE_NAMES: Record<Language, string> = {
	en: "English",
	es: "Español",
};

export const LANGUAGE_OPTIONS: readonly {
	value: LanguagePreference;
}[] = [{ value: "system" }, ...SUPPORTED_LANGUAGES.map((value) => ({ value }) as const)];

export function languageLabel(language: Language): string {
	return LANGUAGE_NAMES[language];
}

function isLanguage(value: string): value is Language {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function resolveLanguagePreference(value: string | null | undefined): LanguagePreference {
	if (value === "system") {
		return value;
	}
	if (typeof value === "string" && isLanguage(value)) {
		return value;
	}
	return DEFAULT_LANGUAGE_PREFERENCE;
}

/** `es-419`, `es_419` and `es-MX` all resolve to the one Spanish catalog. */
export function languageFromTag(tag: string | null | undefined): Language | null {
	if (!tag) {
		return null;
	}
	const primary = tag.split(/[-_]/)[0]?.toLowerCase();
	return primary && isLanguage(primary) ? primary : null;
}

export function resolveLanguage(preference: LanguagePreference, deviceTag: string | null | undefined): Language {
	if (preference !== "system") {
		return preference;
	}
	return languageFromTag(deviceTag) ?? DEFAULT_LANGUAGE;
}
