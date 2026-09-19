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

const PROCESSORS: ReadonlySet<string> = new Set([
    "google",
    "iz",
    "nyx",
    "paypal",
    "pos",
    "pp",
    "sp",
    "sq",
    "squ",
    "sumup",
    "tst",
    "zettle",
    "ztl",
]);

const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
    "abee",
    "abeet",
    "ae",
    "ag",
    "bv",
    "epe",
    "gmbh",
    "ike",
    "inc",
    "llc",
    "ltd",
    "sa",
    "sas",
    "sl",
    "spa",
    "srl",
]);

const REFERENCE_CODE = /^(?=[a-z]*\d)[a-z0-9]{5,}$|^\d+$/;

const GLUED_SUFFIX = /(\p{Ll})(\p{Lu}{2,})/gu;

export function descriptorKey(raw: string): string {
    const star = raw.indexOf("*");
    const body = star !== -1 && PROCESSORS.has(merchantKey(raw.slice(0, star))) ? raw.slice(star + 1) : raw;
    const [first = "", ...rest] = merchantKey(body.replaceAll(GLUED_SUFFIX, "$1 $2")).split(" ");
    const kept = [first, ...rest.filter((token) => !REFERENCE_CODE.test(token))];
    while (kept.length > 1 && LEGAL_SUFFIXES.has(kept[kept.length - 1] ?? "")) {
        kept.pop();
    }
    return kept.join(" ");
}

const MIN_KEY_LENGTH = 3;

export function knowledgeKeys(name: string, currency: string | undefined, merchantName?: string | null): string[] {
    const keys = [merchantKey(name), descriptorKey(name), merchantKey(merchantName ?? "")]
        .filter((key) => key.length >= MIN_KEY_LENGTH)
        .map((key) => (currency ? `${key}${KNOWLEDGE_KEY_DELIMITER}${currency.toLowerCase()}` : key));
    return [...new Set(keys)];
}
