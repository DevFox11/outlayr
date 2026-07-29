import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
			assert.equal(resolveLanguagePreference(language), language);
		}
	});

	it("accepts the system preference", () => {
		assert.equal(resolveLanguagePreference("system"), "system");
	});

	it("falls back to system for an unknown stored value", () => {
		assert.equal(resolveLanguagePreference("klingon"), "system");
	});

	it("falls back to system for a missing stored value", () => {
		assert.equal(resolveLanguagePreference(null), "system");
		assert.equal(resolveLanguagePreference(undefined), "system");
	});
});

describe("languageFromTag", () => {
	it("matches a bare language code", () => {
		assert.equal(languageFromTag("es"), "es");
	});

	it("matches a regional tag by its primary subtag", () => {
		assert.equal(languageFromTag("es-419"), "es");
		assert.equal(languageFromTag("es-MX"), "es");
		assert.equal(languageFromTag("en-GB"), "en");
	});

	it("is case insensitive", () => {
		assert.equal(languageFromTag("ES-mx"), "es");
	});

	it("tolerates an underscore-separated tag", () => {
		assert.equal(languageFromTag("es_419"), "es");
	});

	it("returns null for an unsupported language", () => {
		assert.equal(languageFromTag("fr-FR"), null);
		assert.equal(languageFromTag(""), null);
		assert.equal(languageFromTag(null), null);
	});
});

describe("resolveLanguage", () => {
	it("honours an explicit override regardless of the device", () => {
		assert.equal(resolveLanguage("es", "en-US"), "es");
		assert.equal(resolveLanguage("en", "es-419"), "en");
	});

	it("follows the device when the preference is system", () => {
		assert.equal(resolveLanguage("system", "es-419"), "es");
	});

	it("falls back to the default when the device speaks an unsupported language", () => {
		assert.equal(resolveLanguage("system", "fr-FR"), DEFAULT_LANGUAGE);
	});

	it("falls back to the default when the device tag is unknown", () => {
		assert.equal(resolveLanguage("system", null), DEFAULT_LANGUAGE);
	});
});

describe("LANGUAGE_OPTIONS", () => {
	it("offers system plus every supported language", () => {
		assert.deepEqual(
			LANGUAGE_OPTIONS.map((option) => option.value),
			["system", ...SUPPORTED_LANGUAGES],
		);
	});

	it("names each language in that language, so it is legible to its own speakers", () => {
		assert.equal(languageLabel("en"), "English");
		assert.equal(languageLabel("es"), "Español");
	});
});
