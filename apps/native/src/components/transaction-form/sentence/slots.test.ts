import { describe, expect, it } from "@jest/globals";

import { sentenceSlotNames } from "@/domain/sentence-template";
import { CATALOGS } from "@/i18n/catalog";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

import {
    TRANSACTION_RATE_SENTENCE_KEYS,
    TRANSACTION_RATE_SLOTS,
    TRANSACTION_SENTENCE_KEYS,
    TRANSACTION_SENTENCE_SLOTS,
} from "./slots";

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

    for (const language of SUPPORTED_LANGUAGES) {
        for (const key of TRANSACTION_RATE_SENTENCE_KEYS) {
            it(`states the rate, its source and the dollars in ${language} ${key}`, () => {
                expect([...sentenceSlotNames(CATALOGS[language][key] ?? "")].sort()).toStrictEqual([
                    ...TRANSACTION_RATE_SLOTS,
                ]);
            });
        }
        it(`states the rate and its source while the dollars wait in ${language}`, () => {
            expect(
                [...sentenceSlotNames(CATALOGS[language]["transaction.sentence.rate.pending"] ?? "")].sort()
            ).toStrictEqual(["rate", "rateSource"]);
        });
        it(`asks for the rate alone in ${language} transaction.sentence.rate.missing`, () => {
            expect([...sentenceSlotNames(CATALOGS[language]["transaction.sentence.rate.missing"] ?? "")]).toStrictEqual(
                ["rate"]
            );
        });
    }
});
