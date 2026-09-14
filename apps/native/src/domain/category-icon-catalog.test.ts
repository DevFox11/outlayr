import { describe, expect, it } from "@jest/globals";

import { CATEGORY_EMOJI_GROUPS, CATEGORY_ICON_GROUPS, iconKeysMatching } from "./category-icon-catalog";

const ALL_KEYS = CATEGORY_ICON_GROUPS.flatMap((group) => group.keys);

describe("category icon catalog", () => {
    it("carries 8 groups totalling 163 icon keys", () => {
        expect(CATEGORY_ICON_GROUPS).toHaveLength(8);
        expect(ALL_KEYS).toHaveLength(163);
    });

    it("curates 112 emoji across 8 groups", () => {
        expect(CATEGORY_EMOJI_GROUPS).toHaveLength(8);
        const emojiCount = CATEGORY_EMOJI_GROUPS.reduce((total, group) => total + group.emoji.length, 0);
        expect(emojiCount).toBe(112);
    });
});

describe("iconKeysMatching", () => {
    it("returns every key in group order for an empty or blank query", () => {
        expect(iconKeysMatching("")).toStrictEqual(ALL_KEYS);
        expect(iconKeysMatching("   ")).toStrictEqual(ALL_KEYS);
    });

    it("matches on a keyword synonym", () => {
        expect(iconKeysMatching("groceries").includes("ShoppingCart01")).toBeTruthy();
    });

    it("matches on a name token", () => {
        expect(iconKeysMatching("coffee").includes("Coffee02")).toBeTruthy();
    });

    it("ignores case and diacritics", () => {
        expect(iconKeysMatching("CAFÉ").includes("Coffee02")).toBeTruthy();
    });

    it("returns unique keys with no duplicates", () => {
        const keys = iconKeysMatching("");
        expect(keys).toHaveLength(new Set(keys).size);
    });
});
