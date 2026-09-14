/**
 * How one entry's amount is attributed across categories — the contract every
 * reader that touches `categoryId` has to agree on.
 *
 * THE RULE: an entry is always attributed by its allocations. An entry with no
 * explicit allocations has exactly one implicit allocation — its whole amount to
 * its own `categoryId`. That is what keeps every existing row, and every reader
 * that never learns about splitting, correct by construction: a ledger with no
 * splits produces exactly the allocations it produces today.
 *
 * WHAT DOES NOT CHANGE: anything totalling money without regard to category —
 * the Log's day subtotals, the currency buckets, the period figures. Those read
 * the entry's own amount and must keep doing so. Summing allocations there would
 * be the same number by a longer route, and a rounding difference away from
 * disagreeing with the row the user is looking at.
 */

export interface Allocation {
    /** Unsigned, like the row's own amount: direction comes from `income`. */
    amount: number;
    categoryId: string | null;
}

export interface SplittableEntry {
    amount: number;
    categoryId: string | null;
    id: string;
}

/**
 * The allocations to attribute `entry` by.
 *
 * `explicit` is what the allocations table holds for this entry, which is empty
 * for every entry that has never been split.
 */
export function allocationsFor(entry: SplittableEntry, explicit: readonly Allocation[]): Allocation[] {
    if (explicit.length === 0) {
        return [{ amount: entry.amount, categoryId: entry.categoryId }];
    }
    return explicit.map((allocation) => ({ ...allocation }));
}

/**
 * What is left of `total` after `allocations`.
 *
 * Positive means under-allocated, negative over. The UI needs the signed figure
 * to say which, so this does not clamp.
 */
export function unallocated(total: number, allocations: readonly Allocation[]): number {
    return round(total - allocations.reduce((sum, one) => sum + one.amount, 0));
}

/**
 * Whether a split may be saved.
 *
 * The sum has to match the entry exactly, because the two figures are read side
 * by side: the row shows its own amount and the categories underneath it show
 * the parts. A split that does not add up puts a visible contradiction on
 * screen, and every category total downstream inherits it.
 *
 * A single allocation is not a split — it is the implicit case written down —
 * so it is allowed but pointless, and the UI is what declines to offer it.
 */
export function isBalanced(total: number, allocations: readonly Allocation[]): boolean {
    return allocations.length > 0 && unallocated(total, allocations) === 0;
}

/**
 * `allocations` with `amount` moved onto the entry at `index`, taking the
 * difference out of the last other allocation so the split stays balanced.
 *
 * Editing one part of a split has to move another, or every keystroke leaves the
 * entry unbalanced and unsaveable. The last one absorbs it because it is the one
 * furthest from where the user is typing.
 */
export function rebalance(
    total: number,
    allocations: readonly Allocation[],
    index: number,
    amount: number
): Allocation[] {
    const next = allocations.map((allocation) => ({ ...allocation }));
    if (index < 0 || index >= next.length) {
        return next;
    }
    next[index] = { ...next[index], amount: round(Math.max(0, amount)) };
    const absorber = next.length - 1 === index ? next.length - 2 : next.length - 1;
    if (absorber < 0) {
        return next;
    }
    const others = next.reduce((sum, one, at) => (at === absorber ? sum : sum + one.amount), 0);
    next[absorber] = { ...next[absorber], amount: round(total - others) };
    return next;
}

/**
 * Two decimals, matching what the amounts are stored and displayed at.
 *
 * Every arithmetic result here goes through it, so a split's parts can be summed
 * back to the whole without a float tail turning `isBalanced` into a coin toss.
 */
export function round(value: number): number {
    return Math.round(value * 100) / 100;
}
