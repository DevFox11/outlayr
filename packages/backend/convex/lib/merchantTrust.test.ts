import { describe, expect, test } from "vitest";

import { CANONICAL_CATEGORY_NAMES, corroborates, shouldPublish } from "./merchantTrust";
import { MAX_DOMAIN_LENGTH, MAX_TAG_LENGTH, MAX_TAGS } from "./sanitizeLimits";

const BASE_CANDIDATE = {
    categoryName: "Healthcare",
    domain: "farmatodo.com",
    emoji: null,
    key: "farmatodo",
    parentCategoryName: null,
    tags: ["pharmacy"],
};

describe(corroborates, () => {
    test("accepts the exact host", () => {
        expect(corroborates("farmatodo.com", "https://farmatodo.com/about")).toBeTruthy();
    });

    test("accepts a subdomain of the domain", () => {
        expect(corroborates("farmatodo.com", "https://www.farmatodo.com/about")).toBeTruthy();
    });

    test("rejects a source that merely contains the domain as a substring", () => {
        expect(corroborates("farmatodo.com", "https://evil.test/farmatodo.com")).toBeFalsy();
    });

    test("rejects an unrelated host", () => {
        expect(corroborates("farmatodo.com", "https://evil.test")).toBeFalsy();
    });

    test("rejects an unparseable url", () => {
        expect(corroborates("farmatodo.com", "not a url")).toBeFalsy();
    });
});

describe(shouldPublish, () => {
    test("publishes a confident, corroborated candidate", () => {
        expect(shouldPublish(BASE_CANDIDATE, [{ url: "https://farmatodo.com/es" }])).toBeTruthy();
    });

    test("does not publish when no source corroborates the domain (T3, T6)", () => {
        expect(shouldPublish(BASE_CANDIDATE, [{ url: "https://unrelated-blog.test" }])).toBeFalsy();
    });

    test("does not publish when a source corroborates a different domain (T3)", () => {
        expect(shouldPublish(BASE_CANDIDATE, [{ url: "https://evil.test" }])).toBeFalsy();
    });

    test("does not publish a category outside the canonical set (T3)", () => {
        expect(
            shouldPublish({ ...BASE_CANDIDATE, categoryName: "Rent for Maria's apartment" }, [
                { url: "https://farmatodo.com/es" },
            ])
        ).toBeFalsy();
    });

    test("publishes a currency-scoped key and refuses any other delimiter", () => {
        const sources = [{ url: "https://farmatodo.com/about" }];
        expect(shouldPublish({ ...BASE_CANDIDATE, key: "farmatodo|ves" }, sources)).toBeTruthy();
        expect(shouldPublish({ ...BASE_CANDIDATE, key: "farmatodo|VES" }, sources)).toBeFalsy();
        expect(shouldPublish({ ...BASE_CANDIDATE, key: "farmatodo|ves|eur" }, sources)).toBeFalsy();
        expect(shouldPublish({ ...BASE_CANDIDATE, key: "farmatodo#ves" }, sources)).toBeFalsy();
    });

    test("does not publish when sources is empty (T3)", () => {
        expect(shouldPublish(BASE_CANDIDATE, [])).toBeFalsy();
    });

    test("does not publish a personal string with a null domain (T3, T6)", () => {
        expect(
            shouldPublish(
                {
                    categoryName: "Rent",
                    domain: null,
                    emoji: null,
                    key: "rent for maria s apartment",
                    parentCategoryName: null,
                    tags: [],
                },
                [{ url: "https://farmatodo.com/es" }]
            )
        ).toBeFalsy();
    });

    test("does not publish more than 3 tags", () => {
        expect(
            shouldPublish({ ...BASE_CANDIDATE, tags: ["a", "b", "c", "d"] }, [{ url: "https://farmatodo.com/es" }])
        ).toBeFalsy();
    });
});

// `enrichment.ts` sanitizes down to these and `shouldPublish` re-checks them.
// The re-check is the last thing between a personal string and a row every
// account can read, so it must keep refusing what the sanitizer would have
// trimmed — which it can only do while both sides read the same numbers.
describe("the limits the sanitizer and the filter share", () => {
    const sources = [{ url: "https://farmatodo.com/es" }];

    test("refuses more tags than the sanitizer would have kept", () => {
        const tags = Array.from({ length: MAX_TAGS + 1 }, (_, index) => `tag${index}`);
        expect(shouldPublish({ ...BASE_CANDIDATE, tags }, sources)).toBeFalsy();
    });

    test("refuses a tag longer than the sanitizer would have cut it", () => {
        const tags = ["x".repeat(MAX_TAG_LENGTH + 1)];
        expect(shouldPublish({ ...BASE_CANDIDATE, tags }, sources)).toBeFalsy();
    });

    test("refuses a domain longer than the protocol allows", () => {
        const domain = `${"a".repeat(MAX_DOMAIN_LENGTH)}.com`;
        expect(shouldPublish({ ...BASE_CANDIDATE, domain }, [{ url: `https://${domain}/x` }])).toBeFalsy();
    });

    test("refuses a domain that is not a bare apex", () => {
        expect(shouldPublish({ ...BASE_CANDIDATE, domain: "https://farmatodo.com" }, sources)).toBeFalsy();
    });
});

describe("canonical category names", () => {
    test("includes every preset expense and income category name", () => {
        expect(CANONICAL_CATEGORY_NAMES.has("Healthcare")).toBeTruthy();
        expect(CANONICAL_CATEGORY_NAMES.has("Paycheck")).toBeTruthy();
    });

    test("excludes an arbitrary free-text string", () => {
        expect(CANONICAL_CATEGORY_NAMES.has("Rent for Maria's apartment")).toBeFalsy();
    });
});
