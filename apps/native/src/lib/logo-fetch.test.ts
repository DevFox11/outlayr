import { faviconUrl, fetchMerchantImage, logoDevUrl } from "./logo-fetch";

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

	it("escapes the domain", () => {
		expect(faviconUrl("a b&c")).toContain("domain=a%20b%26c");
	});
});

describe("fetchMerchantImage", () => {
	it("tries the shared cached logo before logo.dev and the favicon", async () => {
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
				return String(url) === "https://r2.example/merchant/zzqq"
					? imageResponse(200, shared)
					: notFound;
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: shared });
		expect(calls).toStrictEqual(["https://r2.example/merchant/zzqq"]);
		expect(calls.some((u) => u.includes("img.logo.dev"))).toBe(false);
		expect(calls.some((u) => u.includes("s2/favicons"))).toBe(false);
	});

	it("falls through to the favicon tier when the shared cached logo url refuses", async () => {
		const favicon = png(1200);
		const calls: string[] = [];
		const result = await fetchMerchantImage(
			{
				name: "zzqq nothing",
				domain: "zzqq-nothing.example",
				logoUrl: "https://r2.example/merchant/zzqq",
			},
			(async (url: string) => {
				calls.push(String(url));
				return String(url) === "https://r2.example/merchant/zzqq"
					? notFound
					: imageResponse(200, favicon);
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: favicon });
		expect(calls[0]).toBe("https://r2.example/merchant/zzqq");
	});

	it("returns none when every tier refuses", async () => {
		const result = await fetchMerchantImage(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			(async () => notFound) as unknown as typeof fetch,
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

	it("falls all the way through to no image when a rejected shared logo and every domain tier refuse", async () => {
		const result = await fetchMerchantImage(
			{
				name: "",
				domain: "zzqq-nothing.example",
				logoUrl: "https://r2.example/merchant/zzq",
			},
			(async () => notFound) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "none" });
	});

	it("skips the shared cached logo tier entirely when no logoUrl is given", async () => {
		const fetchImpl = jest.fn(async (_url: string) => notFound);

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
