import {
	clearEnrichmentCache,
	getCachedEnrichment,
	type RemoteEnrichmentResult,
	setCachedEnrichment,
} from "./enrichment-cache";

beforeEach(() => {
	clearEnrichmentCache();
});

describe("getCachedEnrichment", () => {
	it("reports a miss for a key that was never cached", () => {
		expect(getCachedEnrichment("spotify")).toStrictEqual({ hit: false });
	});

	it("retrieves a positive result that was cached earlier", () => {
		const value = {
			categoryName: "Entertainment",
			isNewCategory: false,
			tags: ["Music", "Streaming"],
			domain: "spotify.com",
		};
		setCachedEnrichment("spotify", value);
		expect(getCachedEnrichment("spotify")).toStrictEqual({
			hit: true,
			value,
		});
	});

	it("caches and retrieves a negative (null) result", () => {
		setCachedEnrichment("some unknown merchant", null);
		expect(getCachedEnrichment("some unknown merchant")).toStrictEqual({
			hit: true,
			value: null,
		});
	});
});

describe("setCachedEnrichment eviction", () => {
	it("evicts the first inserted key once the 51st entry is added", () => {
		for (let i = 0; i < 50; i++) {
			setCachedEnrichment(`merchant-${i}`, null);
		}
		expect(getCachedEnrichment("merchant-0")).toStrictEqual({
			hit: true,
			value: null,
		});

		setCachedEnrichment("merchant-50", null);

		expect(getCachedEnrichment("merchant-0")).toStrictEqual({ hit: false });
		expect(getCachedEnrichment("merchant-1")).toStrictEqual({
			hit: true,
			value: null,
		});
		expect(getCachedEnrichment("merchant-50")).toStrictEqual({
			hit: true,
			value: null,
		});
	});

	it("does not evict when overwriting an existing key at capacity", () => {
		for (let i = 0; i < 50; i++) {
			setCachedEnrichment(`merchant-${i}`, null);
		}
		setCachedEnrichment("merchant-0", {
			categoryName: "Shopping",
			isNewCategory: false,
			tags: [],
			domain: null,
		});
		expect(getCachedEnrichment("merchant-0")).toStrictEqual({
			hit: true,
			value: {
				categoryName: "Shopping",
				isNewCategory: false,
				tags: [],
				domain: null,
			},
		});
		expect(getCachedEnrichment("merchant-1")).toStrictEqual({
			hit: true,
			value: null,
		});
	});
});

describe("shared-cache fields on RemoteEnrichmentResult", () => {
	it("round-trips a cache hit carrying logoKey, logoUrl and grounding", () => {
		const value: RemoteEnrichmentResult = {
			categoryName: "Healthcare",
			isNewCategory: false,
			tags: ["pharmacy"],
			domain: "farmatodo.com",
			logoKey: "merchant/farmatodo",
			logoUrl: "https://r2.example.com/merchant/farmatodo",
			grounding: false,
		};
		setCachedEnrichment("farmatodo", value);
		expect(getCachedEnrichment("farmatodo")).toStrictEqual({
			hit: true,
			value,
		});
	});

	it("omits logoKey, logoUrl and grounding without a type error", () => {
		const value: RemoteEnrichmentResult = {
			categoryName: "Entertainment",
			isNewCategory: false,
			tags: [],
			domain: null,
		};
		setCachedEnrichment("netflix", value);
		expect(getCachedEnrichment("netflix")).toStrictEqual({
			hit: true,
			value,
		});
	});
});

describe("clearEnrichmentCache", () => {
	it("empties every cached entry", () => {
		setCachedEnrichment("spotify", null);
		clearEnrichmentCache();
		expect(getCachedEnrichment("spotify")).toStrictEqual({ hit: false });
	});
});
