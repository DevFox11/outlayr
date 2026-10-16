/**
 * Replicates SwiftUI's `Array.move(fromOffsets:toOffset:)`: `destination` is an
 * index in the pre-removal coordinate space, so shift it back by the number of
 * moved items that sat before it.
 */
export function applyMove<T>(items: readonly T[], sourceIndices: readonly number[], destination: number): T[] {
    const moving = sourceIndices.map((index) => items[index]);
    const rest = items.filter((_, index) => !sourceIndices.includes(index));
    const removedBefore = sourceIndices.filter((index) => index < destination).length;
    const insertAt = destination - removedBefore;
    return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
}

/**
 * `items` with the one at `from` lifted out and put back so it ends up at
 * index `to` of the result: the drag list's move, where `to` is the slot the
 * row was dropped on rather than SwiftUI's pre-removal offset. An index outside
 * the list leaves it as it was.
 *
 * A worklet, so a drag reshuffles the rows on the UI thread.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
    "worklet";
    const next = [...items];
    if (from < 0 || from >= next.length || to < 0 || to >= next.length) {
        return next;
    }
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/**
 * The slot under a row whose top edge sits `offset` below the list's top, in a
 * list of `count` rows `rowHeight` tall. The row counts as over the next slot
 * once it covers half of it, and never leaves the list.
 */
export function slotAt(offset: number, rowHeight: number, count: number): number {
    "worklet";
    if (count <= 0 || rowHeight <= 0) {
        return 0;
    }
    return Math.min(count - 1, Math.max(0, Math.round(offset / rowHeight)));
}
