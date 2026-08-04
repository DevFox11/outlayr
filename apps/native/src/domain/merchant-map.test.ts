import {
	capitalizeCategoryName,
	SUGGESTED_CATEGORY_PRESETS,
} from "@/data/categories-core";
import { MERCHANT_INDEX, MERCHANTS } from "./merchant-map";
import { merchantKey, resolveMerchant } from "./merchant-resolver";
import { normalizeTagName, TAG_NAME_LIMIT } from "./tags";

const VALID_CATEGORY_NAMES = new Set(
	[
		...SUGGESTED_CATEGORY_PRESETS.expense,
		...SUGGESTED_CATEGORY_PRESETS.income,
	].map((preset) => preset.name),
);

describe("seeding the curated merchant map", () => {
	it("keeps every id unique", () => {
		const ids = MERCHANTS.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("stores every tag in its already-normalized display form", () => {
		for (const entry of MERCHANTS) {
			for (const tag of entry.tags) {
				expect(normalizeTagName(tag)).toBe(tag);
				expect(tag.length).toBeLessThanOrEqual(TAG_NAME_LIMIT);
			}
		}
	});

	it("stores every categoryName already capitalized and drawn from a suggested preset", () => {
		for (const entry of MERCHANTS) {
			expect(capitalizeCategoryName(entry.categoryName)).toBe(
				entry.categoryName,
			);
			expect(VALID_CATEGORY_NAMES.has(entry.categoryName)).toBe(true);
		}
	});

	it("keeps every pattern's matching key unique across every entry", () => {
		const keys = MERCHANTS.flatMap((entry) =>
			entry.patterns.map((pattern) => merchantKey(pattern)),
		);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("keeps the seed inside the curated size budget", () => {
		expect(MERCHANTS.length).toBeGreaterThanOrEqual(140);
		expect(MERCHANTS.length).toBeLessThanOrEqual(160);
	});

	it("includes the required named merchants verbatim", () => {
		const byId = new Map(MERCHANTS.map((entry) => [entry.id, entry]));

		expect(byId.get("duolingo")).toStrictEqual({
			id: "duolingo",
			patterns: ["duolingo", "duolingo super", "duolingo plus"],
			categoryName: "Education",
			tags: ["Learning", "Subscription"],
			domain: "duolingo.com",
		});
		expect(byId.get("netflix")).toStrictEqual({
			id: "netflix",
			patterns: ["netflix"],
			categoryName: "Entertainment",
			tags: ["Streaming", "Subscription"],
			domain: "netflix.com",
		});
		expect(byId.get("apple")).toStrictEqual({
			id: "apple",
			patterns: ["apple", "apple store", "apple com bill"],
			categoryName: "Shopping",
			tags: ["Apple"],
			domain: "apple.com",
		});
		expect(byId.get("apple-music")).toStrictEqual({
			id: "apple-music",
			patterns: ["apple music", "itunes music"],
			categoryName: "Entertainment",
			tags: ["Music", "Streaming", "Subscription"],
			domain: "music.apple.com",
		});
		expect(byId.get("youtube")).toStrictEqual({
			id: "youtube",
			patterns: ["youtube", "youtube premium"],
			categoryName: "Entertainment",
			tags: ["Streaming", "Subscription"],
			domain: "youtube.com",
		});
		expect(byId.get("youtube-music")).toStrictEqual({
			id: "youtube-music",
			patterns: ["youtube music", "yt music"],
			categoryName: "Entertainment",
			tags: ["Music", "Streaming", "Subscription"],
			domain: "music.youtube.com",
		});
	});
});

describe("regional merchant coverage", () => {
	it("resolves every reported LATAM merchant name", () => {
		const reported = [
			"Gama supermercados",
			"Forum SuperMayorista",
			"Central Madeirense",
			"Farmatodo",
			"Automercados Plaza's",
		];
		for (const name of reported) {
			expect(resolveMerchant(name)?.categoryName ?? null).not.toBeNull();
		}
	});
});

describe("logo.dev domain backfill", () => {
	it("resolves a verified logo.dev domain for each backfilled merchant", () => {
		const verified: Record<string, string> = {
			"central madeirense": "centralmadeirense.com",
			locatel: "locatel.com.ve",
			farmahorro: "farmahorro.com",
			traki: "traki.com",
			digitel: "digitel.com.ve",
		};
		for (const [name, domain] of Object.entries(verified)) {
			expect(resolveMerchant(name)?.domain).toBe(domain);
		}
	});

	it("leaves the two merchants logo.dev cannot serve without a domain", () => {
		expect(resolveMerchant("automercados plazas")?.domain).toBeNull();
		expect(resolveMerchant("cantv")?.domain).toBeNull();
	});
});

describe("the module-load merchant index", () => {
	it("holds every pattern as a key", () => {
		for (const entry of MERCHANTS) {
			for (const pattern of entry.patterns) {
				expect(MERCHANT_INDEX.get(pattern)?.id).toBe(entry.id);
			}
		}
	});

	it("orders apple music before the bare apple pattern", () => {
		const keys = [...MERCHANT_INDEX.keys()];
		expect(keys.indexOf("apple music")).toBeLessThan(keys.indexOf("apple"));
	});

	it("orders youtube music before the bare youtube pattern", () => {
		const keys = [...MERCHANT_INDEX.keys()];
		expect(keys.indexOf("youtube music")).toBeLessThan(keys.indexOf("youtube"));
	});
});
