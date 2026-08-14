import { rebalance, round } from "./split";
import type { Allocation } from "./split";

/**
 * The editing moves a split sheet needs, on top of the arithmetic in
 * `split.ts`. Kept apart from it because these are about what a user is doing
 * to a draft, while `split.ts` is about what an attribution means.
 */

/**
 * Opens a split on an entry that has none.
 *
 * One part holding the whole amount, because that is what the entry already
 * says: an unsplit entry is attributed wholly to its own category. Starting
 * from anything else would make opening the sheet an edit.
 */
export function openDraft(total: number, categoryId: string | null): Allocation[] {
    return [{ amount: round(total), categoryId }];
}

/**
 * Appends a part holding nothing.
 *
 * Zero rather than an even share, so adding a category never silently restates
 * the amounts the user already typed. The draft stays balanced, and the new
 * part is filled by editing it — which is what moves the difference out of a
 * neighbour.
 */
export function addPart(allocations: readonly Allocation[], categoryId: string | null): Allocation[] {
    return [...allocations.map((one) => ({ ...one })), { amount: 0, categoryId }];
}

/**
 * Drops a part and hands its amount to the last one left.
 *
 * The alternative is leaving the total short and the split unsaveable, which
 * turns removing a category into two chores.
 */
export function removePart(allocations: readonly Allocation[], index: number): Allocation[] {
    if (index < 0 || index >= allocations.length) {
        return allocations.map((one) => ({ ...one }));
    }
    const next = allocations.filter((_, at) => at !== index).map((one) => ({ ...one }));
    const freed = allocations[index].amount;
    if (next.length === 0) {
        return next;
    }
    const last = next.length - 1;
    next[last] = { ...next[last], amount: round(next[last].amount + freed) };
    return next;
}

/**
 * Sets one part's amount, moving the difference out of a neighbour.
 *
 * `rebalance` clamps the part being edited but not the one absorbing, so a
 * draft with nothing left to take from would show a negative amount — e.g.
 * adding two categories before typing anything, then filling the second.
 * The absorber is floored at zero and the draft is allowed to go unbalanced
 * instead: the sheet already states the remainder and the save already refuses
 * it, and "you have allocated more than the entry" is true where a negative
 * part is merely confusing.
 */
export function setPartAmount(
    total: number,
    allocations: readonly Allocation[],
    index: number,
    amount: number
): Allocation[] {
    return rebalance(total, allocations, index, amount).map((one) => (one.amount < 0 ? { ...one, amount: 0 } : one));
}

/** Sets one part's category, leaving every amount alone. */
export function setPartCategory(
    allocations: readonly Allocation[],
    index: number,
    categoryId: string | null
): Allocation[] {
    return allocations.map((one, at) => (at === index ? { ...one, categoryId } : { ...one }));
}

/**
 * Whether this draft is worth storing.
 *
 * A single part is the same statement as no split at all — the entry attributed
 * wholly to one category — so it is stored as no split, which is what keeps
 * `allocationsFor` returning the implicit whole rather than an equivalent row.
 */
export function isRealSplit(allocations: readonly Allocation[]): boolean {
    return allocations.length > 1;
}
