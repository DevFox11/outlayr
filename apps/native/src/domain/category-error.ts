import { CATEGORY_ERROR_MESSAGES } from "@/data/categories-core";
import type { CategoryError } from "@/data/categories-core";
import type { TranslationKey } from "@/i18n/catalog";

/**
 * The repo signals a rejected save by throwing one of `CATEGORY_ERROR_MESSAGES`,
 * so the only handle the UI has on which rule fired is the English text itself.
 */
export const CATEGORY_ERROR_KEYS = {
    duplicate: "categories.error.duplicate",
    duplicateEmoji: "categories.error.duplicateEmoji",
    duplicateIcon: "categories.error.duplicateIcon",
    duplicateName: "categories.error.duplicateName",
    incomplete: "categories.error.incomplete",
    missingIcon: "categories.error.missingIcon",
    missingName: "categories.error.missingName",
} satisfies Record<CategoryError, TranslationKey>;

export function categoryErrorCode(message: string): CategoryError | null {
    const match = Object.entries(CATEGORY_ERROR_MESSAGES).find(([, text]) => text === message);
    // SAFETY: `match` is an entry of CATEGORY_ERROR_MESSAGES, whose keys are
    // exactly the `CategoryError` union — `Object.entries` widens them to string.
    return match ? (match[0] as CategoryError) : null;
}
