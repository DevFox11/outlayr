import { fetchLogo, logoUrl } from "./logo-fetch";

function png(length = 1024): Uint8Array {
	const bytes = new Uint8Array(length).fill(0x42);
	bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
	return bytes;
}

function respond(
	status: number,
	contentType: string | null,
	bytes: Uint8Array,
): Response {
	return {
		status,
		headers: { get: () => contentType },
		arrayBuffer: async () => bytes.buffer,
	} as unknown as Response;
}

describe("logoUrl", () => {
	it("escapes the domain rather than interpolating it raw", () => {
		expect(logoUrl("music.apple.com")).toBe(
			"https://www.google.com/s2/favicons?domain=music.apple.com&sz=128",
		);
		expect(logoUrl("a b&c")).toContain("domain=a%20b%26c");
	});
});

describe("fetchLogo", () => {
	it("returns the bytes for a real logo", async () => {
		const bytes = png();
		const result = await fetchLogo("netflix.com", async () =>
			respond(200, "image/png", bytes),
		);
		expect(result).toStrictEqual({ kind: "logo", bytes });
	});

	it("returns none for a null domain without calling out", async () => {
		const fetchImpl = jest.fn();
		expect(
			await fetchLogo(null, fetchImpl as unknown as typeof fetch),
		).toStrictEqual({
			kind: "none",
		});
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("returns none for the 404 a miss actually arrives as", async () => {
		const result = await fetchLogo("nope.example", async () =>
			respond(404, "image/png", png(726)),
		);
		expect(result).toStrictEqual({ kind: "none" });
	});

	it("returns none when the request throws", async () => {
		const result = await fetchLogo("netflix.com", async () => {
			throw new Error("offline");
		});
		expect(result).toStrictEqual({ kind: "none" });
	});

	it("returns none when the body is not an image", async () => {
		const html = new TextEncoder().encode(
			"<html>not an image</html>".repeat(40),
		);
		const result = await fetchLogo("netflix.com", async () =>
			respond(200, "image/png", html),
		);
		expect(result).toStrictEqual({ kind: "none" });
	});
});
