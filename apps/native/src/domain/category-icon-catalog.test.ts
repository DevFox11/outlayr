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
        const keys = iconKeysMatching("groceries");
        expect(keys).toContain("ShoppingCart01");
        expect(keys).not.toContain("Airplane01");
    });

    it("matches on a name token", () => {
        const keys = iconKeysMatching("coffee");
        expect(keys).toContain("Coffee02");
        expect(keys).not.toContain("Car01");
    });

    it("ignores case and diacritics", () => {
        const keys = iconKeysMatching("CAFÉ");
        expect(keys).toContain("Coffee02");
        expect(keys).not.toContain("Bus01");
    });

    it("narrows rather than reordering the whole catalog", () => {
        expect(iconKeysMatching("coffee").length).toBeLessThan(ALL_KEYS.length);
    });

    it("answers nothing for a query no icon carries", () => {
        expect(iconKeysMatching("zzzznotanicon")).toStrictEqual([]);
    });

    it("returns unique keys with no duplicates", () => {
        const keys = iconKeysMatching("");
        expect(keys).toHaveLength(new Set(keys).size);
    });
});
