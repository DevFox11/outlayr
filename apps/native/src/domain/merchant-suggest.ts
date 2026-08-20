import { MERCHANTS } from "./merchant-map";
import { merchantKey } from "./merchant-resolver";

/** Below this the catalogue answers with half of itself, which is not a suggestion. */
const MIN_QUERY_LENGTH = 2;

interface Ranked {
    label: string;
    /** Shorter canonical patterns are the closer answer to a short prefix. */
    length: number;
}

/**
 * Curated merchants whose name starts with what has been typed, nearest first.
 *
 * Matching runs over the normalised `patterns`, which is what the typed query
 * folds down to; the name offered is the entry's own `label`.
 *
 * A linear pass over the catalogue's ~150 entries: the index is keyed on whole
 * patterns, so it answers an exact spelling and nothing else, and there is no
 * prefix structure to walk. At this size the scan costs less than the keystroke
 * that triggered it.
 */
export function suggestMerchants(query: string, limit: number, exclude: readonly string[] = []): string[] {
    const key = merchantKey(query);
    if (key.length < MIN_QUERY_LENGTH) {
        return [];
    }
    const skip = new Set(exclude.map((name) => merchantKey(name)));
    const ranked: Ranked[] = [];
    for (const entry of MERCHANTS) {
        const [canonical] = entry.patterns;
        if (canonical === undefined || skip.has(canonical)) {
            continue;
        }
        if (!entry.patterns.some((pattern) => pattern.startsWith(key))) {
            continue;
        }
        ranked.push({ label: entry.label, length: canonical.length });
    }
    ranked.sort((a, b) => a.length - b.length);
    return ranked.slice(0, limit).map((entry) => entry.label);
}
