import { describe, expect, it } from "@jest/globals";

import { DEFAULT_LANGUAGE, languageFromTag, resolveLanguage } from "./languages";

describe("languageFromTag", () => {
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
        expect(languageFromTag("fr-FR")).toBeNull();
        expect(languageFromTag("")).toBeNull();
        expect(languageFromTag(null)).toBeNull();
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
});
