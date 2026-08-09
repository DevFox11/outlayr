import { CATEGORY_ERROR_MESSAGES, type CategoryError } from "@/data/categories-core";
import type { TranslationKey } from "@/i18n/catalog";

/**
 * The repo signals a rejected save by throwing one of `CATEGORY_ERROR_MESSAGES`,
 * so the only handle the UI has on which rule fired is the English text itself.
 */
export const CATEGORY_ERROR_KEYS: Record<CategoryError, TranslationKey> = {
	duplicate: "categories.error.duplicate",
	duplicateEmoji: "categories.error.duplicateEmoji",
	duplicateIcon: "categories.error.duplicateIcon",
	duplicateName: "categories.error.duplicateName",
	incomplete: "categories.error.incomplete",
	missingIcon: "categories.error.missingIcon",
	missingName: "categories.error.missingName",
};

export function categoryErrorCode(message: string): CategoryError | null {
	const match = Object.entries(CATEGORY_ERROR_MESSAGES).find(([, text]) => text === message);
	return match ? (match[0] as CategoryError) : null;
}
