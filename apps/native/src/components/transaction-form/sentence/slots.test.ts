import { describe, expect, it } from "@jest/globals";

import { sentenceSlotNames } from "@/domain/sentence-template";
import { CATALOGS } from "@/i18n/catalog";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

import { TRANSACTION_SENTENCE_KEYS, TRANSACTION_SENTENCE_SLOTS } from "./slots";

const expected = [...TRANSACTION_SENTENCE_SLOTS].sort();

describe("transaction sentence templates", () => {
    /*
     * `catalog.test.ts` already holds every locale to English's placeholder set.
     * This adds the half that cannot catch: a slot dropped from BOTH languages
     * at once, which agrees with itself and still loses a fact off the screen.
     */
    for (const language of SUPPORTED_LANGUAGES) {
        for (const key of TRANSACTION_SENTENCE_KEYS) {
            it(`states every fact once in ${language} ${key}`, () => {
                const template = CATALOGS[language][key];
                expect(template).toBeDefined();
                expect([...sentenceSlotNames(template ?? "")].sort()).toStrictEqual(expected);
            });
        }
    }

    for (const language of SUPPORTED_LANGUAGES) {
        for (const key of TRANSACTION_SENTENCE_KEYS) {
            it(`closes the ${language} ${key} sentence`, () => {
                expect(CATALOGS[language][key]?.trim().endsWith(".")).toBe(true);
            });
        }
    }
});
