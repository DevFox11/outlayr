import type { Category, CategoryWithChildren } from "@/data/categories-core";

export interface CategoryMatch {
    category: Category;
    matchLength: number;
    /** Offset of the match inside the untouched `category.name`. */
    matchStart: number;
    /** Null for a top-level match; the owning parent for a child, so the row can show a breadcrumb. */
    parent: Category | null;
}

export function categorySearchKey(value: string): string {
    return fold(value.trim()).folded;
}

/**
 * Folded per code point rather than over the whole string, so `origIndex` can map
 * an offset in the folded text back to the original: `"Café"` stored decomposed
 * loses its combining mark to the fold, and every offset after it would otherwise
 * point one character early and cut the highlight short.
 */
function fold(value: string): { folded: string; origIndex: number[] } {
    let folded = "";
    const origIndex: number[] = [];
    let offset = 0;
    for (const char of value) {
        const stripped = char
            .normalize("NFD")
            .replaceAll(/\p{Diacritic}/gu, "")
            .toLowerCase();
        const at = offset;
        origIndex.push(...Array.from({ length: stripped.length }, () => at));
        folded += stripped;
        offset += char.length;
    }
    origIndex.push(value.length);
    return { folded, origIndex };
}

function match(category: Category, query: string, parent: Category | null): CategoryMatch | null {
    const name = category.name ?? "";
    const { folded, origIndex } = fold(name);
    const at = folded.indexOf(query);
    if (at === -1) {
        return null;
    }
    const start = origIndex[at] ?? 0;
    const end = origIndex[at + query.length] ?? name.length;
    return { category, matchLength: end - start, matchStart: start, parent };
}

/**
 * Flattened to one list: a child is reachable in a single tap during search
 * rather than behind its parent's disclosure. Tree order is kept so results do
 * not reshuffle between keystrokes.
 */
export function searchCategoryTree(tree: CategoryWithChildren[], query: string): CategoryMatch[] {
    const needle = categorySearchKey(query);
    if (needle.length === 0) {
        return [];
    }
    const matches: CategoryMatch[] = [];
    for (const parent of tree) {
        const parentMatch = match(parent, needle, null);
        if (parentMatch != null) {
            matches.push(parentMatch);
        }
        for (const child of parent.children) {
            const childMatch = match(child, needle, parent);
            if (childMatch != null) {
                matches.push(childMatch);
            }
        }
    }
    return matches;
}

/**
 * Without this the sheet presents every parent collapsed, so a transaction whose
 * category is a subcategory shows no checkmark on any row and reads as unset.
 */
export function expandedForSelectedCategory(tree: CategoryWithChildren[], selectedId: string | null): Set<string> {
    if (selectedId == null) {
        return new Set();
    }
    for (const parent of tree) {
        if (parent.children.some((child) => child.id === selectedId)) {
            return new Set([parent.id]);
        }
    }
    return new Set();
}
