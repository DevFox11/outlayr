import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORY_ERROR_MESSAGES } from "@/data/categories-core";
import { EN } from "@/i18n/catalog";
import { translate } from "@/i18n/translate";
import { CATEGORY_ERROR_KEYS, categoryErrorCode } from "./category-error";

describe("categoryErrorCode", () => {
	for (const [code, message] of Object.entries(CATEGORY_ERROR_MESSAGES)) {
		it(`matches the repo's "${code}" message`, () => {
			assert.equal(categoryErrorCode(message), code);
		});
	}

	it("returns null for a message the repo never throws", () => {
		assert.equal(categoryErrorCode("not a category error"), null);
	});
});

describe("CATEGORY_ERROR_KEYS", () => {
	const en = (key: string) => translate(key, { catalog: EN, fallback: EN });

	it("resolves every code to its English error copy", () => {
		assert.equal(
			en(CATEGORY_ERROR_KEYS.incomplete),
			"Please choose an icon or emoji, and a name.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.missingIcon),
			"Please choose an icon or emoji for the category.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.missingName),
			"Please enter a name for this category.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.duplicate),
			"A category with this symbol and name already exists.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.duplicateIcon),
			"Another category already uses this icon.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.duplicateEmoji),
			"Another category already uses this emoji.",
		);
		assert.equal(
			en(CATEGORY_ERROR_KEYS.duplicateName),
			"Another category already uses this name.",
		);
	});
});
