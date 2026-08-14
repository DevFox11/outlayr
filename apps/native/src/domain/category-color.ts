import { CATEGORY_PALETTE } from "@/data/categories-core";

/**
 * The next unused palette colour, or — once every one is taken — the palette
 * entry the fewest categories already carry.
 *
 * The old fallback was literal white, which was invisible the moment a category
 * tile drew its wash on a paper ground, and reachable as soon as a ledger held
 * more categories than the palette has entries.
 */
export function firstAvailableColor(used: ReadonlySet<string>): string {
    const free = CATEGORY_PALETTE.find((hex) => !used.has(hex));
    return free ?? CATEGORY_PALETTE[used.size % CATEGORY_PALETTE.length];
}
