import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";

import { clearEnrichmentCache } from "@/domain/enrichment-cache";
import { fetchMerchantImage } from "@/lib/logo-fetch";

import { useMerchantMark } from "./use-merchant-mark";

const mockCacheUris = new Map<string, string>();

jest.mock<Partial<typeof import("@/lib/logo-cache")>>("@/lib/logo-cache", () => ({
    cachedLogoUri: (key: string) => mockCacheUris.get(key) ?? null,
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
    mockCacheUris.clear();
    mockCacheUris.set("netflix.com|netflix.com", "file:///cache/netflix");
    clearEnrichmentCache();
});

describe("useMerchantMark", () => {
    it("answers from the cache on the first render, and nothing for a merchant with no domain", async () => {
        const { result: known } = await renderHook(() => useMerchantMark("Netflix"));
        expect(known.current).toBe("file:///cache/netflix");
        const { result: unknown } = await renderHook(() => useMerchantMark("Corner Bakery"));
        expect(unknown.current).toBeNull();
        expect(fetchMerchantImage).not.toHaveBeenCalled();
    });

    it("falls back to the domain the agent answered when the map has no entry", async () => {
        const { result } = await renderHook(() => useMerchantMark("Mercadona", "mercadona.es"));
        await waitFor(() => expect(result.current).toBe("file:///cache/mercadona.es"));
        expect(fetchMerchantImage).toHaveBeenCalledWith({ domain: "mercadona.es", name: "mercadona.es" });
    });

    it("fetches an uncached merchant once, keyed by its domain, and lands the uri", async () => {
        const { result } = await renderHook(() => useMerchantMark("Spotify"));
        await waitFor(() => expect(result.current).toBe("file:///cache/spotify.com"));
        expect(fetchMerchantImage).toHaveBeenCalledTimes(1);
        expect(fetchMerchantImage).toHaveBeenCalledWith({ domain: "spotify.com", name: "spotify.com" });
    });
});
