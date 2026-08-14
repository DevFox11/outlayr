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
