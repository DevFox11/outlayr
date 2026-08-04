import { faviconUrl, fetchMerchantImage, logoDevUrl } from "./logo-fetch";

jest.mock("@/lib/logo-cache", () => ({
	logoCacheKey: () => "test-key",
	readCachedLogo: () => ({ kind: "unknown" }),
	writeCachedLogo: () => {},
}));

jest.mock("@outlayr/env/native", () => ({
	env: { EXPO_PUBLIC_LOGO_DEV_TOKEN: "pk_test" },
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
	it("tries logo.dev before the favicon, with no shared-cache tier ahead of it", async () => {
		const branded = png(900);
		const calls: string[] = [];
		const result = await fetchMerchantImage(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			(async (url: string) => {
				calls.push(String(url));
				return String(url).includes("img.logo.dev")
					? imageResponse(200, branded)
					: notFound;
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: branded });
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain("img.logo.dev");
	});

	it("falls through to the favicon tier when logo.dev refuses", async () => {
		const favicon = png(1200);
		const calls: string[] = [];
		const result = await fetchMerchantImage(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			(async (url: string) => {
				calls.push(String(url));
				return String(url).includes("img.logo.dev")
					? notFound
					: imageResponse(200, favicon);
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: favicon });
		expect(calls[0]).toContain("img.logo.dev");
		expect(calls[1]).toContain("s2/favicons");
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

	it("skips straight to the favicon when no logo.dev token is configured", async () => {
		jest.resetModules();
		jest.doMock("@outlayr/env/native", () => ({
			env: { EXPO_PUBLIC_LOGO_DEV_TOKEN: undefined },
		}));
		const { fetchMerchantImage: fetchWithNoToken } =
			require("./logo-fetch") as typeof import("./logo-fetch");

		const favicon = png(1300);
		const calls: string[] = [];
		const result = await fetchWithNoToken(
			{ name: "zzqq nothing", domain: "zzqq-nothing.example" },
			(async (url: string) => {
				calls.push(String(url));
				return imageResponse(200, favicon);
			}) as unknown as typeof fetch,
		);

		expect(result).toStrictEqual({ kind: "logo", bytes: favicon });
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain("s2/favicons");
		jest.dontMock("@outlayr/env/native");
	});
});
