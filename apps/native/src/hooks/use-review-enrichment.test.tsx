import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";

import type { ImportEntry } from "@/data/transfer-core";
import { clearEnrichmentCache, setCachedEnrichment } from "@/domain/enrichment-cache";
import { merchantKey } from "@/domain/merchant-resolver";
import { fetchMerchantImage } from "@/lib/logo-fetch";

import { useReviewEnrichment } from "./use-review-enrichment";

const mockCacheUris = new Map<string, string>();
const cacheReads: string[] = [];

jest.mock<Partial<typeof import("@/lib/logo-cache")>>("@/lib/logo-cache", () => ({
    cachedLogoUri: (key: string) => {
        cacheReads.push(key);
        return mockCacheUris.get(key) ?? null;
    },
    logoCacheKey: (name: string, domain: string | null) => `${name}|${domain ?? ""}`.toLowerCase(),
}));

jest.mock("@/lib/logo-fetch", () => ({
    fetchMerchantImage: jest.fn(async ({ name, domain }) => {
        mockCacheUris.set(`${name}|${domain}`.toLowerCase(), `file:///cache/${domain}`);
        return { bytes: new Uint8Array([1]), kind: "logo" };
    }),
}));

beforeEach(() => {
    jest.mocked(fetchMerchantImage).mockClear();
    cacheReads.length = 0;
    mockCacheUris.clear();
    mockCacheUris.set("netflix.com|netflix.com", "file:///cache/netflix");
    clearEnrichmentCache();
});

function entry(note: string): ImportEntry {
    return {
        amount: 10,
        categoryId: "cat-1",
        currency: null,
        date: new Date(2026, 6, 28),
        income: false,
        note,
    };
}

describe("useReviewEnrichment", () => {
    it("pairs each entry index with its cleaned name and any cached logo", async () => {
        const entries = [entry("NETFLIX 12345678901"), entry("Corner Bakery")];
        const { result } = await renderHook(() => useReviewEnrichment(entries));

        expect(result.current.get(0)).toStrictEqual({
            displayName: "NETFLIX",
            logoUri: "file:///cache/netflix",
        });
        expect(result.current.get(1)).toStrictEqual({
            displayName: "Corner Bakery",
            logoUri: null,
        });
    });

    it("fetches the logo of an uncached merchant with a domain, exactly once", async () => {
        const entries = [entry("SPOTIFY P2E4B8"), entry("Spotify"), entry("Corner Bakery")];
        const { result } = await renderHook(() => useReviewEnrichment(entries));

        await waitFor(() => {
            expect(result.current.get(0)?.logoUri).toBe("file:///cache/spotify.com");
        });
        expect(jest.mocked(fetchMerchantImage)).toHaveBeenCalledTimes(1);
        expect(result.current.get(2)?.logoUri).toBeNull();
    });

    it("fetches the logo for a noisy note whose enrichment entry is keyed by the clean name", async () => {
        setCachedEnrichment(merchantKey("Blue Bottle Coffee"), {
            categoryName: "Food & Drink",
            domain: "bluebottlecoffee.com",
            isNewCategory: false,
            tags: [],
        });
        const entries = [entry("BLUE BOTTLE COFFEE #08761")];
        const { result } = await renderHook(() => useReviewEnrichment(entries));

        await waitFor(() => {
            expect(result.current.get(0)?.logoUri).toBe("file:///cache/bluebottlecoffee.com");
        });
    });

    it("never re-fetches a merchant the cache already answers for", async () => {
        const entries = [entry("NETFLIX")];
        await renderHook(() => useReviewEnrichment(entries));
        expect(jest.mocked(fetchMerchantImage)).not.toHaveBeenCalled();
    });

    it("keeps a stable map identity for the same entries", async () => {
        const entries = [entry("NETFLIX")];
        const { result, rerender } = await renderHook(() => useReviewEnrichment(entries));
        const first = result.current;
        await rerender(undefined);
        expect(result.current).toBe(first);
    });
});

describe("logo cache reads", () => {
    it("reads the disk once per merchant, not once per row", async () => {
        // `cachedLogoUri` is several blocking filesystem calls and can mkdir and
        // unlink, so a read per row is what made a large import expensive.
        const entries = Array.from({ length: 20 }, () => entry("NETFLIX 12345678901"));

        await renderHook(() => useReviewEnrichment(entries));

        expect(cacheReads.filter((key) => key === "netflix.com|netflix.com")).toHaveLength(1);
    });
});
