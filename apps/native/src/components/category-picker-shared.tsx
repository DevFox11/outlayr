import type { Category } from "@/data/categories-core";
import type { CategoryMatch } from "@/domain/category-search";

import { Text } from "./text";

/**
 * What the category picker's iOS and Android pieces share
 * (`category-picker-chrome.tsx` and its sibling). Its own module because a
 * `.android.tsx` file importing its plain twin would import itself.
 */

/** A category's tile colour: income reads as income, anything unset as neutral grey. */
export function categoryTint(category: Category, incomeColor: string): string {
    return category.income ? incomeColor : (category.color ?? "#767676");
}

/** The name with the searched-for run in bold `tint`. */
export function HighlightedName({ name, match, tint }: { name: string; match?: CategoryMatch; tint: string }) {
    if (match == null || match.matchLength === 0) {
        return name;
    }
    const end = match.matchStart + match.matchLength;
    return (
        <>
            {name.slice(0, match.matchStart)}
            <Text className="font-sans-bold" style={{ color: tint }}>
                {name.slice(match.matchStart, end)}
            </Text>
            {name.slice(end)}
        </>
    );
}
