/**
 * Longest pattern first, so "bbva provincial" is reached before "bbva" and
 * "banco santander" before "santander": a more specific name must not be
 * answered by a shorter one it happens to contain.
 */
export function buildPatternIndex<T extends { readonly patterns: readonly string[] }>(
    entries: readonly T[]
): ReadonlyMap<string, T> {
    const ranked = entries.flatMap((entry) =>
        entry.patterns.map((pattern) => ({ entry, pattern, tokenCount: pattern.split(" ").length }))
    );
    ranked.sort((a, b) => {
        const tokenDiff = b.tokenCount - a.tokenCount;
        return tokenDiff === 0 ? b.pattern.length - a.pattern.length : tokenDiff;
    });
    return new Map(ranked.map(({ pattern, entry }) => [pattern, entry]));
}

/** Whether `needle` appears in `haystack` as a run of whole tokens. */
export function containsTokenSequence(haystack: readonly string[], needle: readonly string[]): boolean {
    return needle.length > 0 && ` ${haystack.join(" ")} `.includes(` ${needle.join(" ")} `);
}
