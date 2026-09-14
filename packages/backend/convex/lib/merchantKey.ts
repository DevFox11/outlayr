/**
 * Duplicated from `apps/native/src/domain/merchant-resolver.ts:9-17` rather
 * than imported — the backend package must not depend on `apps/native` (see
 * the tasks artifact's Package Graph Decision). Two raw input strings that
 * normalize to the same key are "the same query" for both the curated map
 * and this shared cache.
 */
export function merchantKey(raw: string): string {
    return raw
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replaceAll(/\s+/g, " ");
}

/**
 * Between the merchant key and the currency. `merchantKey` folds everything
 * but letters, digits and single spaces, so this cannot appear in one: a
 * merchant named "Acme EUR" and "Acme" in EUR stay two keys.
 */
const KNOWLEDGE_KEY_DELIMITER = "|";

/**
 * The shared knowledge cache's identity. Scoped by the currency the purchase
 * was in when the caller knew it: a name that is one business in Iowa and
 * another in Paris must not hand the first's domain to the second, and the
 * currency is the locator the lookup itself was given. A caller with no
 * currency (the CSV import) reads and fills the bare partition.
 */
export function knowledgeKey(name: string, currency: string | undefined): string {
    const key = merchantKey(name);
    return currency ? `${key}${KNOWLEDGE_KEY_DELIMITER}${currency.toLowerCase()}` : key;
}
