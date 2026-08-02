import {
	CATEGORY_ERROR_MESSAGES,
	type CategoryError,
} from "@/data/categories-core";
import type { TranslationKey } from "@/i18n";

/**
 * The repo signals a rejected save by throwing one of `CATEGORY_ERROR_MESSAGES`,
 * so the only handle the UI has on which rule fired is the English text itself.
 */
export const CATEGORY_ERROR_KEYS: Record<CategoryError, TranslationKey> = {
	incomplete: "categories.error.incomplete",
	missingIcon: "categories.error.missingIcon",
	missingName: "categories.error.missingName",
	duplicate: "categories.error.duplicate",
	duplicateIcon: "categories.error.duplicateIcon",
	duplicateEmoji: "categories.error.duplicateEmoji",
	duplicateName: "categories.error.duplicateName",
};

export function categoryErrorCode(message: string): CategoryError | null {
	const match = Object.entries(CATEGORY_ERROR_MESSAGES).find(
		([, text]) => text === message,
	);
	return match ? (match[0] as CategoryError) : null;
}
