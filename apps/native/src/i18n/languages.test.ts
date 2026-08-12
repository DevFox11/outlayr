import { DEFAULT_LANGUAGE, languageFromTag, languageLabel, resolveLanguage } from "./languages";

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
	it("follows the device", () => {
		expect(resolveLanguage("es-419")).toBe("es");
		expect(resolveLanguage("en-US")).toBe("en");
	});

	it("falls back to the default when the device speaks an unsupported language", () => {
		expect(resolveLanguage("fr-FR")).toBe(DEFAULT_LANGUAGE);
	});

	it("falls back to the default when the device tag is unknown", () => {
		expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE);
	});
});

describe("languageLabel", () => {
	it("names each language in that language, so it is legible to its own speakers", () => {
		expect(languageLabel("en")).toBe("English");
		expect(languageLabel("es")).toBe("Español");
	});
});
