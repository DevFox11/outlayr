export interface RemoteEnrichmentResult {
	readonly categoryName: string | null;
	readonly isNewCategory: boolean;
	/** An existing top-level category this one belongs beneath, if any. */
	readonly parentCategoryName?: string | null;
	readonly emoji?: string | null;
	readonly tags: readonly string[];
	readonly domain: string | null;
	/** Shared-cache object key. */
	readonly logoKey?: string | null;
	readonly logoUrl?: string | null;
	/** A grounded lookup was scheduled server-side; do not cache this as final. */
	readonly grounding?: boolean;
}

export type EnrichmentCacheLookup =
	| { hit: true; value: RemoteEnrichmentResult | null }
	| { hit: false };

const CACHE_LIMIT = 50;

const cache = new Map<string, RemoteEnrichmentResult | null>();

export function getCachedEnrichment(key: string): EnrichmentCacheLookup {
	if (!cache.has(key)) {
		return { hit: false };
	}
	return { hit: true, value: cache.get(key) ?? null };
}

export function setCachedEnrichment(
	key: string,
	value: RemoteEnrichmentResult | null,
): void {
	if (!cache.has(key) && cache.size >= CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) {
			cache.delete(oldestKey);
		}
	}
	cache.set(key, value);
}

export function clearEnrichmentCache(): void {
	cache.clear();
}
