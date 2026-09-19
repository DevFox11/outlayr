import { describe, expect, test } from "vitest";

import { descriptorKey, knowledgeKeys } from "./merchantKey";

describe(descriptorKey, () => {
    test.each([
        ["AIRBNB * HMASFW2JP2", "airbnb"],
        ["AIRBNB * ZX81KQ7", "airbnb"],
        ["NYX*VenetisABEET", "venetis"],
        ["CARE4BAG AE", "care4bag"],
        ["SQ *BLUE BOTTLE COFFEE", "blue bottle coffee"],
        ["PAYPAL *STEAM GAMES", "steam games"],
        ["TST* SUSHI WAY LES HA", "sushi way les ha"],
        ["BLUE BOTTLE COFFEE #08761", "blue bottle coffee"],
        ["FIUMICINO AEROPORTO SS", "fiumicino aeroporto ss"],
        ["UBER *EATS PENDING", "uber eats pending"],
        ["PayPal", "paypal"],
        ["Panadería San José", "panaderia san jose"],
    ])("%s decodes to %s", (raw, expected) => {
        expect(descriptorKey(raw)).toBe(expected);
    });
});

describe(knowledgeKeys, () => {
    test("files one answer under the raw name, the decoded descriptor and the merchant's own name", () => {
        expect(knowledgeKeys("NYX*VenetisABEET", "EUR", "Venetis Bakery")).toStrictEqual([
            "nyx venetisabeet|eur",
            "venetis|eur",
            "venetis bakery|eur",
        ]);
    });

    test("drops duplicates and keys too short to mean anything", () => {
        expect(knowledgeKeys("Airbnb", undefined, "Airbnb")).toStrictEqual(["airbnb"]);
        expect(knowledgeKeys("AB", undefined)).toStrictEqual([]);
    });
});
