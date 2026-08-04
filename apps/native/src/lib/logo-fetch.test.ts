import {
	appIconSearchUrl,
	faviconUrl,
	fetchMerchantImage,
	logoDevUrl,
} from "./logo-fetch";

jest.mock("@/lib/logo-cache", () => ({
	logoCacheKey: () => "test-key",
	readCachedLogo: () => ({ kind: "unknown" }),
	writeCachedLogo: () => {},
}));

function png(length = 1024): Uint8Array {
	const bytes = new Uint8Array(length).fill(0x42);
	bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
	return bytes;
}

function imageResponse(status: number, bytes: Uint8Array): Response {
	return {
		status,
		headers: { get: () => "image/png" },
		arrayBuffer: async () => bytes.buffer,
	} as unknown as Response;
}

function searchResponse(trackName: string, sellerName: string): Response {
	return {
		status: 200,
		headers: { get: () => "application/json" },
		json: async () => ({
			results: [
				{ trackName, sellerName, artworkUrl512: "https://icons/app.jpg" },
			],
		}),
	} as unknown as Response;
}

const notFound = {
	status: 404,
	headers: { get: () => "application/json" },
	arrayBuffer: async () => new Uint8Array(0).buffer,
} as unknown as Response;

describe("url builders", () => {
	it("asks logo.dev for a 404 rather than its monogram fallback", () => {
		// The default is a generic letter tile returned with a 200 — the exact
		// avatar this feature promises never to show.
		expect(logoDevUrl("netflix.com", "pk_test")).toContain("fallback=404");
		expect(logoDevUrl("netflix.com", "pk_test")).toContain("size=512");
	});

	it("escapes the domain and the term", () => {
		expect(faviconUrl("a b&c")).toContain("domain=a%20b%26c");
		expect(appIconSearchUrl("apple music")).toContain("term=apple%20music");
	});
});

describe("fetchMerchantImage", () => {
	it("prefers an app icon when the store hit is plausibly the same brand", async () => {
		const icon = png(2048);
		const calls: string[] = [];
		const result = await fetchMerchantImage(
			{ name: "Netflix", domain: "netflix.com" },
			(async (url: string) => {
				calls.push(String(url));
				return String(url).includes("itunes")
					? searchResponse("Netflix", "Netflix, Inc.")
					: imageResponse(200, icon);
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: icon });
		expect(calls.some((u) => u.includes("img.logo.dev"))).toBe(false);
		expect(calls.some((u) => u.includes("s2/favicons"))).toBe(false);
	});

	it("falls past an unrelated store hit to the domain tiers", async () => {
		const favicon = png(1500);
		const result = await fetchMerchantImage(
			{ name: "Trader Joes", domain: "traderjoes.com" },
			(async (url: string) =>
				String(url).includes("itunes")
					? searchResponse("TJ Near & Hot: Grocery Finder", "DNNR Tech")
					: imageResponse(200, favicon)) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: favicon });
	});

	it("returns none when every tier refuses", async () => {
		const result = await fetchMerchantImage(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			(async (url: string) =>
				String(url).includes("itunes")
					? searchResponse("ZOX.", "ZOX, LLC")
					: notFound) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "none" });
	});

	it("returns none without calling out when there is no name or domain", async () => {
		const fetchImpl = jest.fn();
		const result = await fetchMerchantImage(
			{ name: "", domain: null },
			fetchImpl as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "none" });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("survives a thrown request", async () => {
		const result = await fetchMerchantImage(
			{ name: "Netflix", domain: "netflix.com" },
			(async () => {
				throw new Error("offline");
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "none" });
	});

	it("tries the shared cached logo before the domain-based tiers", async () => {
		const shared = png(900);
		const calls: string[] = [];
		const result = await fetchMerchantImage(
			{
				name: "zzqq nothing",
				domain: "zzqq-nothing.example",
				logoUrl: "https://r2.example/merchant/zzqq",
			},
			(async (url: string) => {
				calls.push(String(url));
				if (String(url).includes("itunes")) {
					return searchResponse("ZOX.", "ZOX, LLC");
				}
				if (String(url) === "https://r2.example/merchant/zzqq") {
					return imageResponse(200, shared);
				}
				return notFound;
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: shared });
		expect(calls.some((u) => u.includes("img.logo.dev"))).toBe(false);
		expect(calls.some((u) => u.includes("s2/favicons"))).toBe(false);
	});

	it("falls through to the favicon tier when the shared cached logo url refuses", async () => {
		const favicon = png(1200);
		const result = await fetchMerchantImage(
			{
				name: "zzqq nothing",
				domain: "zzqq-nothing.example",
				logoUrl: "https://r2.example/merchant/zzqq",
			},
			(async (url: string) => {
				if (String(url).includes("itunes")) {
					return searchResponse("ZOX.", "ZOX, LLC");
				}
				if (String(url) === "https://r2.example/merchant/zzqq") {
					return notFound;
				}
				return imageResponse(200, favicon);
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: favicon });
	});

	it("skips the shared cached logo tier entirely when no logoUrl is given", async () => {
		const fetchImpl = jest.fn(async (url: string) =>
			String(url).includes("itunes")
				? searchResponse("ZOX.", "ZOX, LLC")
				: notFound,
		);

		await fetchMerchantImage(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			fetchImpl as unknown as typeof fetch,
		);

		expect(
			(fetchImpl.mock.calls as [string][]).some(([url]) =>
				url.includes("r2.example"),
			),
		).toBe(false);
	});
});
