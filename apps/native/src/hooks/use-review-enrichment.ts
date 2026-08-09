import { useEffect, useMemo, useState } from "react";
import type { ImportEntry } from "@/data/transfer-core";
import { reviewEntryIdentity } from "@/domain/import-review-identity";
import { cachedLogoUri, logoCacheKey } from "@/lib/logo-cache";
import { fetchMerchantImage } from "@/lib/logo-fetch";

export interface ReviewEnrichment {
	displayName: string;
	logoUri: string | null;
}

const FETCH_BATCH = 4;

export function useReviewEnrichment(entries: readonly ImportEntry[]): ReadonlyMap<number, ReviewEnrichment> {
	const identities = useMemo(() => entries.map((entry) => reviewEntryIdentity(entry.note)), [entries]);
	const [fetched, setFetched] = useState<ReadonlyMap<string, string | null>>(new Map());

	useEffect(() => {
		const pending = new Map<string, { name: string; domain: string }>();
		for (const identity of identities) {
			if (identity.domain == null) {
				continue;
			}
			// Keyed by domain, not label: fifty differently-noisy rows of one
			// merchant must cost one request, and a logo belongs to the domain.
			const key = logoCacheKey(identity.domain, identity.domain);
			if (pending.has(key) || cachedLogoUri(key) != null) {
				continue;
			}
			pending.set(key, { domain: identity.domain, name: identity.domain });
		}
		if (pending.size === 0) {
			return;
		}
		let cancelled = false;
		const queue = [...pending.entries()];
		const settle = (key: string) => {
			if (cancelled) {
				return;
			}
			setFetched((prev) => {
				if (prev.has(key)) {
					return prev;
				}
				const next = new Map(prev);
				next.set(key, cachedLogoUri(key));
				return next;
			});
		};
		const worker = async () => {
			for (;;) {
				const item = queue.shift();
				if (item == null || cancelled) {
					return;
				}
				const [key, request] = item;
				// biome-ignore lint/performance/noAwaitInLoops: this loop IS the concurrency limit — FETCH_BATCH workers drain one shared queue, so a worker must finish its fetch before it takes the next domain, or every merchant in the file would be requested at once
				await fetchMerchantImage(request).catch(() => null);
				settle(key);
			}
		};
		for (let i = 0; i < Math.min(FETCH_BATCH, queue.length); i += 1) {
			worker();
		}
		return () => {
			cancelled = true;
		};
	}, [identities]);

	return useMemo(() => {
		const map = new Map<number, ReviewEnrichment>();
		identities.forEach((identity, index) => {
			const key = identity.domain == null ? null : logoCacheKey(identity.domain, identity.domain);
			const logoUri = key == null ? null : (cachedLogoUri(key) ?? fetched.get(key) ?? null);
			map.set(index, { displayName: identity.displayName, logoUri });
		});
		return map;
	}, [identities, fetched]);
}
