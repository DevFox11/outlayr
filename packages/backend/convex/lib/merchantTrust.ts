// oxlint-disable unicorn/filename-case -- Convex keys the module by its path — `_generated/api.d.ts:53` carries "lib/merchantTrust" — and regenerating that is not a lint fix

const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const MAX_DOMAIN_LENGTH = 253;
/** A merchant key, optionally scoped to a currency — see `knowledgeKey`. */
const KEY_PATTERN = /^[a-z0-9 ]{3,64}(\|[a-z]{3})?$/;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 24;

/**
 * The 33 preset expense/income category names from
 * `apps/native/src/data/categories-core.ts:371-405`, duplicated rather than
 * imported — the backend package must not depend on `apps/native` (see the
 * tasks artifact's Package Graph Decision). `Gifts` appears in both lists in
 * the source, so the deduped set has 32 entries.
 */
export const CANONICAL_CATEGORY_NAMES: ReadonlySet<string> = new Set([
    "Groceries",
    "Dining Out",
    "Coffee",
    "Transport",
    "Fuel",
    "Rent",
    "Home",
    "Utilities",
    "Phone & Internet",
    "Subscriptions",
    "Healthcare",
    "Fitness",
    "Shopping",
    "Fashion",
    "Entertainment",
    "Travel",
    "Education",
    "Gifts",
    "Pets",
    "Family",
    "Personal Care",
    "Insurance",
    "Taxes",
    "Paycheck",
    "Freelance",
    "Part-Time",
    "Business",
    "Investments",
    "Interest",
    "Bonus",
    "Tips",
    "Refund",
]);

export interface KnowledgeCandidate {
    categoryName: string | null;
    domain: string | null;
    emoji: string | null;
    key: string;
    parentCategoryName: string | null;
    tags: readonly string[];
}

/**
 * Exact host or a subdomain of it. Deliberately not a public-suffix parse:
 * this check may only ever reject, never widen — a source url whose host
 * merely contains `domain` as a substring (e.g. a path segment) must not
 * corroborate it.
 */
export function corroborates(domain: string, sourceUrl: string): boolean {
    let host: string;
    try {
        host = new URL(sourceUrl).hostname.toLowerCase();
    } catch {
        return false;
    }
    const normalizedDomain = domain.toLowerCase();
    return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

function isSanitizedDomain(domain: string): boolean {
    return domain.length <= MAX_DOMAIN_LENGTH && DOMAIN_PATTERN.test(domain);
}

function tagsAreSanitized(tags: readonly string[]): boolean {
    if (tags.length > MAX_TAGS) {
        return false;
    }
    return tags.every((tag) => tag.length > 0 && tag === tag.trim() && tag.length <= MAX_TAG_LENGTH);
}

function emojiIsSanitized(emoji: string | null): boolean {
    if (emoji === null) {
        return true;
    }
    const trimmed = emoji.trim();
    if (trimmed !== emoji || trimmed.length === 0 || [...trimmed].length > 3) {
        return false;
    }
    return EMOJI_PATTERN.test(trimmed);
}

/**
 * The privacy filter. ALL rules must hold or nothing is written globally —
 * rule 2 (a real source url corroborating the domain) is what stops a
 * personal string like "Rent for Maria's apartment" from ever being
 * persisted: no public source exists for it, and a null domain fails rule 1
 * first regardless.
 */
export function shouldPublish(candidate: KnowledgeCandidate, sources: readonly { url: string }[]): boolean {
    const { domain } = candidate;
    if (domain === null || !isSanitizedDomain(domain)) {
        return false;
    }
    if (!sources.some((source) => corroborates(domain, source.url))) {
        return false;
    }
    if (candidate.categoryName === null || !CANONICAL_CATEGORY_NAMES.has(candidate.categoryName)) {
        return false;
    }
    if (!KEY_PATTERN.test(candidate.key)) {
        return false;
    }
    if (!tagsAreSanitized(candidate.tags)) {
        return false;
    }
    if (!emojiIsSanitized(candidate.emoji)) {
        return false;
    }
    return true;
}
