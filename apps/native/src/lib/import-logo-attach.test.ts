import type { ImportEntry } from "@/data/transfer-core";
import { attachImportLogos } from "./import-logo-attach";

jest.mock("@/domain/import-review-identity", () => ({
	reviewEntryIdentity: (note: string) => ({
		displayName: note,
		domain: note.toLowerCase().startsWith("spotify") ? "spotify.com" : null,
	}),
}));

jest.mock("@/lib/logo-cache", () => ({
	logoCacheKey: (name: string, domain: string | null) =>
		`${name}|${domain ?? ""}`.toLowerCase(),
	readCachedLogo: jest.fn(async (key: string) =>
		key === "spotify.com|spotify.com"
			? { kind: "logo", bytes: new Uint8Array([7]) }
			: { kind: "unknown" },
	),
}));

const mockPersist = jest.fn(
	async (_bytes: Uint8Array) => "file:///documents/logo-1.png",
);
jest.mock("@/lib/photo-storage", () => ({
	persistLogoBytes: (bytes: Uint8Array) => mockPersist(bytes),
}));

jest.mock("@/theme/glow", () => ({
	glowFromImage: jest.fn(async () => ["#1DB954"]),
}));

function entry(note: string): ImportEntry {
	return {
		note,
		categoryId: "cat-1",
		income: false,
		amount: 10,
		currency: null,
		date: new Date(2026, 6, 28),
	};
}

beforeEach(() => {
	mockPersist.mockClear();
});

describe("attachImportLogos", () => {
	it("attaches a persisted logo copy and tint to every row of a cached merchant", async () => {
		const result = await attachImportLogos([
			entry("Spotify"),
			entry("SPOTIFY 2"),
			entry("Corner Bakery"),
		]);

		expect(result[0]?.imageUri).toBe("file:///documents/logo-1.png");
		expect(result[0]?.imageColor).toBe("#1DB954");
		expect(result[1]?.imageUri).toBe("file:///documents/logo-1.png");
		expect(result[2]?.imageUri).toBeUndefined();
		expect(mockPersist).toHaveBeenCalledTimes(2);
	});

	it("leaves entries untouched when the cache has no logo", async () => {
		const result = await attachImportLogos([entry("Corner Bakery")]);
		expect(result[0]).toStrictEqual(entry("Corner Bakery"));
		expect(mockPersist).not.toHaveBeenCalled();
	});
});
