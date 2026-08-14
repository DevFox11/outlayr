import { MERCHANT_INDEX } from "./merchant-map";
import type { MerchantEntry } from "./merchant-map";

export interface MerchantMatch {
    readonly categoryName: string;
    readonly domain: string | null;
    readonly tags: readonly string[];
}

export function merchantKey(raw: string): string {
    return raw
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replaceAll(/\s+/g, " ");
}

function containsTokenSequence(haystack: readonly string[], needle: readonly string[]): boolean {
    if (needle.length === 0 || needle.length > haystack.length) {
        return false;
    }
    for (let start = 0; start <= haystack.length - needle.length; start += 1) {
        let matched = true;
        for (let offset = 0; offset < needle.length; offset += 1) {
            if (haystack[start + offset] !== needle[offset]) {
                matched = false;
                break;
            }
        }
        if (matched) {
            return true;
        }
    }
    return false;
}

function resolveAlias(key: string): MerchantEntry | null {
    const tokens = key.split(" ");
    for (const [pattern, entry] of MERCHANT_INDEX) {
        if (containsTokenSequence(tokens, pattern.split(" "))) {
            return entry;
        }
    }
    return null;
}

const FUZZY_MIN_KEY_LENGTH = 5;
const FUZZY_MAX_DISTANCE = 1;
const FUZZY_EARLY_EXIT_DISTANCE = 2;

/**
 * Bailing out once a row's minimum exceeds `earlyExitAt` avoids computing the
 * full O(n*m) table for candidates that are obviously too far apart.
 */
function boundedLevenshtein(a: string, b: string, earlyExitAt: number): number {
    if (Math.abs(a.length - b.length) > earlyExitAt) {
        return earlyExitAt + 1;
    }
    let previous = Array.from({ length: b.length + 1 }, (_, col) => col);
    for (let row = 1; row <= a.length; row += 1) {
        const current: number[] = [row];
        let rowMin = row;
        for (let col = 1; col <= b.length; col += 1) {
            const cost = a[row - 1] === b[col - 1] ? 0 : 1;
            const value = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost);
            current.push(value);
            rowMin = Math.min(rowMin, value);
        }
        if (rowMin > earlyExitAt) {
            return earlyExitAt + 1;
        }
        previous = current;
    }
    return previous[b.length];
}

function resolveFuzzy(key: string): MerchantEntry | null {
    if (key.length < FUZZY_MIN_KEY_LENGTH) {
        return null;
    }
    const firstChar = key.charAt(0);
    const matches = new Set<MerchantEntry>();
    for (const [pattern, entry] of MERCHANT_INDEX) {
        if (pattern.charAt(0) !== firstChar) {
            continue;
        }
        if (Math.abs(pattern.length - key.length) > FUZZY_MAX_DISTANCE) {
            continue;
        }
        if (boundedLevenshtein(key, pattern, FUZZY_EARLY_EXIT_DISTANCE) <= FUZZY_MAX_DISTANCE) {
            matches.add(entry);
        }
    }
    return matches.size === 1 ? [...matches][0] : null;
}

function toMatch(entry: MerchantEntry, domain: string | null): MerchantMatch {
    return { categoryName: entry.categoryName, domain, tags: entry.tags };
}

export function resolveMerchant(rawName: string): MerchantMatch | null {
    const key = merchantKey(rawName);
    if (key.length === 0) {
        return null;
    }

    const exact = MERCHANT_INDEX.get(key);
    if (exact != null) {
        return toMatch(exact, exact.domain);
    }

    const alias = resolveAlias(key);
    if (alias != null) {
        return toMatch(alias, alias.domain);
    }

    const fuzzy = resolveFuzzy(key);
    if (fuzzy != null) {
        return toMatch(fuzzy, null);
    }

    return null;
}
