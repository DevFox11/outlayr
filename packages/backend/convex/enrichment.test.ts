/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { EMPTY, rateLimiter, runSuggest, suggestArgs } from "./enrichment";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.unstubAllEnvs();
});

/**
 * `Output.object` sends `{type: "json", schema}` and parses the model's text
 * response as JSON — there is no tool-call path to fake, so a mock model only
 * needs to return the JSON payload as a single text content part.
 */
function mockModel(payload: unknown) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text", text: JSON.stringify(payload) }],
			finishReason: { unified: "stop", raw: undefined },
			usage: {
				inputTokens: {
					total: undefined,
					noCache: undefined,
					cacheRead: undefined,
					cacheWrite: undefined,
				},
				outputTokens: {
					total: undefined,
					text: undefined,
					reasoning: undefined,
				},
			},
			warnings: [],
		}),
	});
}

const BASE_ARGS = {
	name: "netflix",
	income: false,
	knownCategoryNames: ["Entertainment", "Groceries"],
};

describe("suggestArgs", () => {
	test("carries exactly the four privacy-boundary fields", () => {
		// Amounts, dates, accounts, balances, and identity must never leave the
		// device — this is a threat-matrix assertion, not a shape convenience.
		expect(Object.keys(suggestArgs).sort()).toEqual(
			["income", "knownCategoryNames", "locale", "name"].sort(),
		);
	});
});

describe("suggest guard ladder", () => {
	test("returns EMPTY for a signed-out caller", async () => {
		const t = convexTest(schema, modules);

		await expect(t.action(api.enrichment.suggest, BASE_ARGS)).resolves.toEqual(
			EMPTY,
		);
	});

	test("returns EMPTY when XAI_API_KEY is unset", async () => {
		vi.stubEnv("XAI_API_KEY", "");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, BASE_ARGS),
		).resolves.toEqual(EMPTY);
	});

	test("returns EMPTY for a name shorter than 3 trimmed characters", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: " hi ",
			}),
		).resolves.toEqual(EMPTY);
	});

	test("returns EMPTY for a name longer than 64 trimmed characters", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: "a".repeat(65),
			}),
		).resolves.toEqual(EMPTY);
	});

	test("returns EMPTY and never throws once the per-user bucket is exhausted", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);
		const asUser = authenticatedAs(t, identity);
		const tokenIdentifier = await asUser.run(
			async (ctx) => (await ctx.auth.getUserIdentity())?.tokenIdentifier,
		);
		if (!tokenIdentifier) {
			throw new Error("Expected an authenticated identity");
		}

		// A fresh key's bucket starts at full capacity (8, the configured max a
		// single call may request); draining it in one call is deterministic
		// because it is the very first write for this key — the component takes
		// its single-shard fast path with no random sampling.
		await t.run(async (ctx) =>
			rateLimiter.limit(ctx, "enrichmentPerUser", {
				key: tokenIdentifier,
				count: 8,
			}),
		);

		await expect(
			asUser.action(api.enrichment.suggest, BASE_ARGS),
		).resolves.toEqual(EMPTY);
	});

	test("returns EMPTY and never throws once the global window is exhausted", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		// The global limit is sharded 10 ways and sampled at random per call, so
		// exhausting it deterministically through real component writes would
		// mean draining all 10 shards. Asserting the guard reads a failed check
		// correctly does not require re-proving the component's own sharding
		// math (that is the library's concern) — only that a not-ok result short
		// circuits before any model call.
		const limitSpy = vi
			.spyOn(rateLimiter, "limit")
			.mockImplementation(async (_ctx, name) =>
				name === "enrichmentGlobal"
					? { ok: false, retryAfter: 1000 }
					: { ok: true, retryAfter: undefined },
			);

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, BASE_ARGS),
		).resolves.toEqual(EMPTY);
		expect(limitSpy).toHaveBeenCalledWith(
			expect.anything(),
			"enrichmentGlobal",
		);
	});
});

describe("runSuggest sanitisation", () => {
	test("trims category name, tags and domain from well-formed model output", async () => {
		const model = mockModel({
			categoryName: "  Streaming  ",
			isNewCategory: true,
			tags: ["  Music  ", "Streaming"],
			domain: "  netflix.com  ",
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toEqual({
			categoryName: "Streaming",
			isNewCategory: true,
			tags: ["Music", "Streaming"],
			domain: "netflix.com",
		});
	});

	test("drops empty tags and caps the rest at 3 entries of 24 characters", async () => {
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: ["", "  ", "a".repeat(30), "second", "third", "fourth"],
			domain: null,
		});

		const result = await runSuggest(model, {
			...BASE_ARGS,
			knownCategoryNames: [],
		});

		expect(result.tags).toEqual(["a".repeat(24), "second", "third"]);
	});

	test("rejects a domain that is not a bare host.tld shape", async () => {
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: [],
			domain: "https://netflix.com/watch",
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toMatchObject({ domain: null });
	});

	test("case-folds an otherwise valid domain instead of rejecting it", async () => {
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: [],
			domain: "NETFLIX.COM",
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toMatchObject({ domain: "netflix.com" });
	});

	test("rejects a domain longer than 253 characters", async () => {
		const longDomain = `${"a".repeat(251)}.co`;
		expect(longDomain.length).toBeGreaterThan(253);
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: [],
			domain: longDomain,
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toMatchObject({ domain: null });
	});

	test("nulls out an empty category name", async () => {
		const model = mockModel({
			categoryName: "   ",
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toMatchObject({ categoryName: null });
	});

	test("nulls out a category name longer than 40 characters", async () => {
		const model = mockModel({
			categoryName: "a".repeat(41),
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames: [] }),
		).resolves.toMatchObject({ categoryName: null });
	});

	test("recomputes isNewCategory as true when the model discards it but the name is unknown", async () => {
		const model = mockModel({
			categoryName: "Pets",
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, {
				...BASE_ARGS,
				knownCategoryNames: ["Entertainment", "Groceries"],
			}),
		).resolves.toMatchObject({ categoryName: "Pets", isNewCategory: true });
	});

	test("recomputes isNewCategory as false when the model claims new but the name is already known", async () => {
		const model = mockModel({
			categoryName: "Entertainment",
			isNewCategory: true,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, {
				...BASE_ARGS,
				knownCategoryNames: ["Entertainment", "Groceries"],
			}),
		).resolves.toMatchObject({
			categoryName: "Entertainment",
			isNewCategory: false,
		});
	});

	test("caps knownCategoryNames at 60 entries for the isNewCategory check", async () => {
		const knownCategoryNames = Array.from({ length: 61 }, (_, i) => `Cat${i}`);
		// The 61st name is pushed out of the server-side cap, so it must read as
		// "new" even though the caller technically listed it as known.
		const model = mockModel({
			categoryName: "Cat60",
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, knownCategoryNames }),
		).resolves.toMatchObject({ categoryName: "Cat60", isNewCategory: true });
	});
});
