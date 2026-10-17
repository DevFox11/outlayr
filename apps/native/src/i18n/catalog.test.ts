import { describe, expect, it } from "@jest/globals";
import { getIntlayer } from "intlayer";

import { CATALOGS, DICTIONARY_KEYS, EN, ES } from "./catalog";
import { SUPPORTED_LANGUAGES } from "./languages";
import { interpolate } from "./translate";

const PLACEHOLDER = /\{(\w+)\}/g;
const PLURAL_SUFFIX = /_(one|other)$/;

function placeholders(template: string): Set<string> {
    return new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1] as string));
}

describe("catalog parity", () => {
    // Every other test here compares the two catalogs against each other, so an
    // empty pair agrees with itself and all of them pass while the app renders
    // raw keys. A dictionary that fails to resolve contributes nothing rather
    // than throwing, which is exactly the shape a stale `.intlayer/` takes.
    it("ships a populated catalog for every supported language, from every dictionary", () => {
        for (const language of SUPPORTED_LANGUAGES) {
            const catalog = CATALOGS[language];
            expect(Object.keys(catalog).length).toBeGreaterThan(500);
            for (const dictionary of DICTIONARY_KEYS) {
                expect(Object.keys(getIntlayer(dictionary, language)).length).toBeGreaterThan(0);
            }
        }
    });

    it("translates every English key into Spanish", () => {
        const missing = Object.keys(EN).filter((key) => !(key in ES));
        expect(missing).toStrictEqual([]);
    });

    it("declares every key in exactly one dictionary", () => {
        const seen = new Map<string, string>();
        for (const name of DICTIONARY_KEYS) {
            for (const key of Object.keys(getIntlayer(name, "en"))) {
                const owner = seen.get(key);
                expect(owner).toBeUndefined();
                seen.set(key, name);
            }
        }
    });

    it("uses the same placeholders in both languages", () => {
        for (const [key, english] of Object.entries(EN)) {
            const spanish = ES[key as keyof typeof ES];
            if (!spanish) {
                continue;
            }
            expect([...placeholders(spanish)].sort()).toStrictEqual([...placeholders(english)].sort());
        }
    });

    // Android reads a `.android` twin in place of its base key, so a twin whose
    // base was renamed away would never show, and one with other placeholders
    // would render them raw.
    it("gives every Android twin a base key with the same placeholders", () => {
        for (const [key, twin] of Object.entries(EN)) {
            if (!key.endsWith(".android")) {
                continue;
            }
            const base = EN[key.replace(/\.android$/, "") as keyof typeof EN];
            expect(base).toBeDefined();
            expect([...placeholders(twin)].sort()).toStrictEqual([...placeholders(base ?? "")].sort());
        }
    });

    it("pairs every plural key with its counterpart form", () => {
        for (const catalogName of SUPPORTED_LANGUAGES) {
            const catalog = CATALOGS[catalogName];
            for (const key of Object.keys(catalog)) {
                const match = key.match(PLURAL_SUFFIX);
                if (!match) {
                    continue;
                }
                const counterpart =
                    match[1] === "one" ? key.replace(PLURAL_SUFFIX, "_other") : key.replace(PLURAL_SUFFIX, "_one");
                expect(counterpart in catalog).toBeTruthy();
            }
        }
    });

    // Only the `_other` form: a singular may legitimately spell the number out
    // ("One purchase too many"), but a plural that never shows its count is a bug.
    it("interpolates a count into every plural form", () => {
        for (const catalogName of SUPPORTED_LANGUAGES) {
            const catalog = CATALOGS[catalogName];
            for (const [key, template] of Object.entries(catalog)) {
                if (!key.endsWith("_other")) {
                    continue;
                }
                expect(placeholders(template).has("count")).toBeTruthy();
            }
        }
    });

    it("leaves no empty string in either catalog", () => {
        for (const catalogName of SUPPORTED_LANGUAGES) {
            for (const [, value] of Object.entries(CATALOGS[catalogName])) {
                expect(value.trim().length > 0).toBeTruthy();
            }
        }
    });

    it("renders every Spanish string without leaking a placeholder", () => {
        for (const [, template] of Object.entries(ES)) {
            const params = Object.fromEntries([...placeholders(template)].map((name) => [name, "x"]));
            expect(!interpolate(template, params).includes("{")).toBeTruthy();
        }
    });
});
