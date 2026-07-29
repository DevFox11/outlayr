import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CATEGORY_EMOJI_GROUPS,
	CATEGORY_ICON_GROUPS,
	CATEGORY_ICON_KEYWORDS,
	FALLBACK_EXPENSE_ICON,
	FALLBACK_INCOME_ICON,
	iconKeysMatching,
} from "./category-icon-catalog";

const ALL_KEYS = CATEGORY_ICON_GROUPS.flatMap((group) => group.keys);

describe("category icon catalog", () => {
	it("carries 8 groups totalling 163 icon keys", () => {
		assert.equal(CATEGORY_ICON_GROUPS.length, 8);
		assert.equal(ALL_KEYS.length, 163);
	});

	it("has a keyword entry for every icon key", () => {
		for (const key of ALL_KEYS) {
			assert.ok(CATEGORY_ICON_KEYWORDS[key], `missing keywords for ${key}`);
		}
	});

	it("curates 112 emoji across 8 groups", () => {
		assert.equal(CATEGORY_EMOJI_GROUPS.length, 8);
		const emojiCount = CATEGORY_EMOJI_GROUPS.reduce(
			(total, group) => total + group.emoji.length,
			0,
		);
		assert.equal(emojiCount, 112);
	});

	it("pins the income and expense fallbacks", () => {
		assert.equal(FALLBACK_EXPENSE_ICON, "SaleTag01");
		assert.equal(FALLBACK_INCOME_ICON, "Coins01");
	});
});

describe("iconKeysMatching", () => {
	it("returns every key in group order for an empty or blank query", () => {
		assert.deepEqual(iconKeysMatching(""), ALL_KEYS);
		assert.deepEqual(iconKeysMatching("   "), ALL_KEYS);
	});

	it("matches on a keyword synonym", () => {
		assert.ok(iconKeysMatching("groceries").includes("ShoppingCart01"));
	});

	it("matches on a name token", () => {
		assert.ok(iconKeysMatching("coffee").includes("Coffee02"));
	});

	it("ignores case and diacritics", () => {
		assert.ok(iconKeysMatching("CAFÉ").includes("Coffee02"));
	});

	it("returns unique keys with no duplicates", () => {
		const keys = iconKeysMatching("");
		assert.equal(keys.length, new Set(keys).size);
	});
});
