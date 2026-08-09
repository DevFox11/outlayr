import {
	DEFAULT_LANGUAGE,
	LANGUAGE_OPTIONS,
	languageFromTag,
	languageLabel,
	resolveLanguage,
	resolveLanguagePreference,
	SUPPORTED_LANGUAGES,
} from "./languages";

describe("resolveLanguagePreference", () => {
	it("accepts every supported language", () => {
		for (const language of SUPPORTED_LANGUAGES) {
			expect(resolveLanguagePreference(language)).toBe(language);
		}
	});

	it("accepts the system preference", () => {
		expect(resolveLanguagePreference("system")).toBe("system");
	});

	it("falls back to system for an unknown stored value", () => {
		expect(resolveLanguagePreference("klingon")).toBe("system");
	});

	it("falls back to system for a missing stored value", () => {
		expect(resolveLanguagePreference(null)).toBe("system");
		expect(resolveLanguagePreference(undefined)).toBe("system");
	});
});

describe("languageFromTag", () => {
	it("matches a bare language code", () => {
		expect(languageFromTag("es")).toBe("es");
	});

	it("matches a regional tag by its primary subtag", () => {
		expect(languageFromTag("es-419")).toBe("es");
		expect(languageFromTag("es-MX")).toBe("es");
		expect(languageFromTag("en-GB")).toBe("en");
	});

	it("is case insensitive", () => {
		expect(languageFromTag("ES-mx")).toBe("es");
	});

	it("tolerates an underscore-separated tag", () => {
		expect(languageFromTag("es_419")).toBe("es");
	});

	it("returns null for an unsupported language", () => {
		expect(languageFromTag("fr-FR")).toBe(null);
		expect(languageFromTag("")).toBe(null);
		expect(languageFromTag(null)).toBe(null);
	});
});

describe("resolveLanguage", () => {
	it("honours an explicit override regardless of the device", () => {
		expect(resolveLanguage("es", "en-US")).toBe("es");
		expect(resolveLanguage("en", "es-419")).toBe("en");
	});

	it("follows the device when the preference is system", () => {
		expect(resolveLanguage("system", "es-419")).toBe("es");
	});

	it("falls back to the default when the device speaks an unsupported language", () => {
		expect(resolveLanguage("system", "fr-FR")).toBe(DEFAULT_LANGUAGE);
	});

	it("falls back to the default when the device tag is unknown", () => {
		expect(resolveLanguage("system", null)).toBe(DEFAULT_LANGUAGE);
	});
});

describe("LANGUAGE_OPTIONS", () => {
	it("offers system plus every supported language", () => {
		expect(LANGUAGE_OPTIONS.map((option) => option.value)).toStrictEqual(["system", ...SUPPORTED_LANGUAGES]);
	});

	it("names each language in that language, so it is legible to its own speakers", () => {
		expect(languageLabel("en")).toBe("English");
		expect(languageLabel("es")).toBe("Español");
	});
});
