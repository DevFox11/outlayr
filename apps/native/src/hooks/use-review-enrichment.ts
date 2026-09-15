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

    /**
     * What is already on disk, read once per distinct merchant rather than once
     * per row.
     *
     * `cachedLogoUri` is three or more blocking `expo-file-system` calls — and it
     * can create the cache directory and unlink an expired miss marker — so the
     * old shape, a call per row inside a memo that re-ran on every resolved
     * domain, was O(rows x domains) syscalls on the JS thread while the review
     * was on screen. A 500-row file over 50 merchants is about 75,000 of them.
     */
    const onDisk = useMemo(() => {
        const map = new Map<string, string | null>();
        for (const identity of identities) {
            if (identity.domain == null) {
                continue;
            }
            const key = logoCacheKey(identity.domain, identity.domain);
            if (!map.has(key)) {
                map.set(key, cachedLogoUri(key));
            }
        }
        return map;
    }, [identities]);

    useEffect(() => {
        const pending = new Map<string, { name: string; domain: string }>();
        for (const identity of identities) {
            if (identity.domain == null) {
                continue;
            }
            // Keyed by domain, not label: fifty differently-noisy rows of one
            // merchant must cost one request, and a logo belongs to the domain.
            const key = logoCacheKey(identity.domain, identity.domain);
            if (pending.has(key) || onDisk.get(key) != null) {
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
                const resolved = cachedLogoUri(key);
                // Keyed on the VALUE, not on presence: a first attempt that ends
                // indeterminate (a timeout writes no `.miss`, so the key stays
                // fetchable) recorded null, and `prev.has(key)` then refused the
                // later attempt that did succeed. Returning `prev` unchanged when
                // nothing moved keeps the identity, so this costs no renders.
                if (prev.get(key) === resolved) {
                    return prev;
                }
                return new Map(prev).set(key, resolved);
            });
        };
        const worker = async () => {
            let item = queue.shift();
            while (item != null) {
                if (cancelled) {
                    return;
                }
                const [key, request] = item;
                // oxlint-disable-next-line no-await-in-loop -- this loop IS the concurrency limit — FETCH_BATCH workers drain one shared queue, so a worker must finish its fetch before it takes the next domain, or every merchant in the file would be requested at once
                await fetchMerchantImage(request).catch(() => null);
                settle(key);
                item = queue.shift();
            }
        };
        for (let i = 0; i < Math.min(FETCH_BATCH, queue.length); i += 1) {
            worker();
        }
        return () => {
            cancelled = true;
        };
    }, [identities, onDisk]);

    return useMemo(() => {
        const map = new Map<number, ReviewEnrichment>();
        for (const [index, identity] of identities.entries()) {
            const key = identity.domain == null ? null : logoCacheKey(identity.domain, identity.domain);
            const logoUri = key == null ? null : (onDisk.get(key) ?? fetched.get(key) ?? null);
            map.set(index, { displayName: identity.displayName, logoUri });
        }
        return map;
    }, [identities, fetched, onDisk]);
}
