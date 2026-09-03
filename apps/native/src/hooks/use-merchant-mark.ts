import { useEffect, useState } from "react";

import { reviewEntryIdentity } from "@/domain/import-review-identity";
import { cachedLogoUri, logoCacheKey } from "@/lib/logo-cache";
import { fetchMerchantImage } from "@/lib/logo-fetch";

/**
 * The merchant's mark for a name the ledger has not stored yet: the curated
 * map (or a cached remote enrichment) names the domain, else the one the
 * voice agent answered with the draft; the logo cache answers for any merchant
 * seen before, and one fetch fills it for the rest. Null until it lands and
 * null for good when there is none — the caller shows nothing, never a
 * placeholder. Keyed by domain, as the import review keys it, so the voice
 * screen and the review share one cached image per merchant.
 */
export function useMerchantMark(name: string | null, spokenDomain: string | null = null): string | null {
    const domain = (name === null ? null : reviewEntryIdentity(name).domain) ?? spokenDomain;
    const key = domain === null ? null : logoCacheKey(domain, domain);
    const [fetched, setFetched] = useState<{ key: string; uri: string | null } | null>(null);

    useEffect(() => {
        if (key === null || domain === null || cachedLogoUri(key) !== null) {
            return;
        }
        let cancelled = false;
        fetchMerchantImage({ domain, name: domain })
            .catch(() => null)
            .then(() => {
                if (!cancelled) {
                    setFetched({ key, uri: cachedLogoUri(key) });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [domain, key]);

    if (key === null) {
        return null;
    }
    return cachedLogoUri(key) ?? (fetched?.key === key ? fetched.uri : null);
}
