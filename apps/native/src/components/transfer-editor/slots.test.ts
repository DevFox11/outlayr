import { describe, expect, it } from "@jest/globals";

import { sentenceSlotNames } from "@/domain/sentence-template";
import { CATALOGS } from "@/i18n/catalog";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

import { TRANSFER_CUSTOM_RATE_KEY, TRANSFER_SENTENCE_KEYS, TRANSFER_SENTENCE_SLOTS } from "./transfer-sentence";

describe("transfer sentence templates", () => {
    for (const language of SUPPORTED_LANGUAGES) {
        it(`states every fact exactly once across the ${language} clauses`, () => {
            const stated = TRANSFER_SENTENCE_KEYS.filter((key) => key !== "transfers.sentence.noFee").flatMap((key) =>
                sentenceSlotNames(CATALOGS[language][key] ?? "")
            );
            expect(stated.sort()).toStrictEqual([...TRANSFER_SENTENCE_SLOTS].sort());
        });

        it(`states the same facts for a custom rate as for a quoted one in ${language}`, () => {
            expect(sentenceSlotNames(CATALOGS[language][TRANSFER_CUSTOM_RATE_KEY] ?? "")).toStrictEqual(
                sentenceSlotNames(CATALOGS[language]["transfers.sentence.rate"] ?? "")
            );
        });

        it(`keeps the fee slot in the ${language} feeless clause`, () => {
            expect(sentenceSlotNames(CATALOGS[language]["transfers.sentence.noFee"] ?? "")).toStrictEqual(["fee"]);
        });
    }
});
