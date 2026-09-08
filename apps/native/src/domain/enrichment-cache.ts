export interface RemoteEnrichmentResult {
    readonly categoryName: string | null;
    readonly domain: string | null;
    readonly emoji?: string | null;
    /** A grounded lookup was scheduled server-side; do not cache this as final. */
    readonly grounding?: boolean;
    readonly isNewCategory: boolean;
    /** An existing top-level category this one belongs beneath, if any. */
    readonly parentCategoryName?: string | null;
    readonly tags: readonly string[];
}

export type EnrichmentCacheLookup = { hit: true; value: RemoteEnrichmentResult | null } | { hit: false };

const CACHE_LIMIT = 50;

const cache = new Map<string, RemoteEnrichmentResult | null>();

/**
 * Scoped by the currency the lookup was made with, when it had one: the
 * currency is the locator the model is given, so the same name can resolve to
 * a different business in a different currency. A caller with no currency
 * (the import review) reads and fills the bare partition.
 */
function cacheKey(key: string, currency: string | undefined): string {
    return currency ? `${key}|${currency}` : key;
}

export function getCachedEnrichment(key: string, currency?: string): EnrichmentCacheLookup {
    const scoped = cacheKey(key, currency);
    if (!cache.has(scoped)) {
        return { hit: false };
    }
    return { hit: true, value: cache.get(scoped) ?? null };
}

export function setCachedEnrichment(key: string, value: RemoteEnrichmentResult | null, currency?: string): void {
    const scoped = cacheKey(key, currency);
    if (!cache.has(scoped) && cache.size >= CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
            cache.delete(oldestKey);
        }
    }
    cache.set(scoped, value);
}

export function clearEnrichmentCache(): void {
    cache.clear();
}
