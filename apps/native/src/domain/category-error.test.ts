import { CATEGORY_ERROR_MESSAGES } from "@/data/categories-core";
import { EN } from "@/i18n/catalog";
import { translate } from "@/i18n/translate";
import { CATEGORY_ERROR_KEYS, categoryErrorCode } from "./category-error";

describe("categoryErrorCode", () => {
	for (const [code, message] of Object.entries(CATEGORY_ERROR_MESSAGES)) {
		it(`matches the repo's "${code}" message`, () => {
			expect(categoryErrorCode(message)).toBe(code);
		});
	}

	it("returns null for a message the repo never throws", () => {
		expect(categoryErrorCode("not a category error")).toBe(null);
	});
});

describe("CATEGORY_ERROR_KEYS", () => {
	const en = (key: string) => translate(key, { catalog: EN, fallback: EN });

	it("resolves every code to its English error copy", () => {
		expect(en(CATEGORY_ERROR_KEYS.incomplete)).toBe("Please choose an icon or emoji, and a name.");
		expect(en(CATEGORY_ERROR_KEYS.missingIcon)).toBe("Please choose an icon or emoji for the category.");
		expect(en(CATEGORY_ERROR_KEYS.missingName)).toBe("Please enter a name for this category.");
		expect(en(CATEGORY_ERROR_KEYS.duplicate)).toBe("A category with this symbol and name already exists.");
		expect(en(CATEGORY_ERROR_KEYS.duplicateIcon)).toBe("Another category already uses this icon.");
		expect(en(CATEGORY_ERROR_KEYS.duplicateEmoji)).toBe("Another category already uses this emoji.");
		expect(en(CATEGORY_ERROR_KEYS.duplicateName)).toBe("Another category already uses this name.");
	});
});
