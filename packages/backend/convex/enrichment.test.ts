/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import {
	EMPTY,
	maybeScheduleGrounded,
	needsGroundedLookup,
	REQUEST_TIMEOUT_MS,
	rateLimiter,
	runSuggest,
	sanitizeDomain,
	sanitizeRegionCode,
	suggestArgs,
} from "./enrichment";
import { merchantKey } from "./lib/merchantKey";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.unstubAllEnvs();
	// Without this, `rateLimiter.limit`'s `mockImplementation` from the
	// "global window exhausted" test below stayed wrapped onto the shared
	// module-level `rateLimiter` singleton for every later test in this file.
	vi.restoreAllMocks();
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
	groundedLookup: false,
	categoryTree: [
		{ name: "Entertainment", children: [] },
		{ name: "Groceries", children: ["Supermarket"] },
	],
};

describe("suggestArgs", () => {
	test("carries exactly the seven privacy-boundary fields", () => {
		// Amounts, dates, accounts, balances, and identity must never leave the
		// device — this is a threat-matrix assertion, not a shape convenience.
		expect(Object.keys(suggestArgs).sort()).toEqual(
			[
				"categoryTree",
				"groundedLookup",
				"income",
				"knowledgeOnly",
				"locale",
				"name",
				"regionCode",
			].sort(),
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

describe("merchantKnowledge cache (Tier 1.5)", () => {
	async function seedKnowledge(t: ReturnType<typeof convexTest>, name: string) {
		await t.run((ctx) =>
			ctx.db.insert("merchantKnowledge", {
				key: merchantKey(name),
				domain: "farmatodo.com",
				categoryName: "Healthcare",
				parentCategoryName: null,
				emoji: "💊",
				tags: ["pharmacy"],
				resolvedAt: Date.now(),
				modelId: "test-model",
			}),
		);
	}

	test("a cache hit serves category, tags and domain without consuming either rate-limit bucket", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);
		await seedKnowledge(t, "Farmatodo");
		const limitSpy = vi.spyOn(rateLimiter, "limit");

		const result = await authenticatedAs(t, identity).action(
			api.enrichment.suggest,
			{ ...BASE_ARGS, name: "Farmatodo" },
		);

		expect(result).toMatchObject({
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			tags: ["pharmacy"],
			emoji: "💊",
			grounding: false,
		});
		expect(limitSpy).not.toHaveBeenCalled();
	});

	test("case, diacritic and whitespace variants collide to the same cached key", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);
		await seedKnowledge(t, "Farmatodo");
		const asUser = authenticatedAs(t, identity);

		await expect(
			asUser.action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: " FARMÁTODO ",
			}),
		).resolves.toMatchObject({ categoryName: "Healthcare" });
	});

	test("a knowledgeOnly hit serves the cached row exactly like an ordinary hit", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);
		await seedKnowledge(t, "Farmatodo");

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: "Farmatodo",
				knowledgeOnly: true,
			}),
		).resolves.toMatchObject({
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			grounding: false,
		});
	});

	test("a knowledgeOnly miss returns EMPTY without consuming a rate limit or the model", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);
		const limitSpy = vi.spyOn(rateLimiter, "limit");

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: "totally unknown merchant xyz",
				knowledgeOnly: true,
			}),
		).resolves.toEqual(EMPTY);
		expect(limitSpy).not.toHaveBeenCalled();
	});

	test("a cache miss falls through to the existing guard ladder unchanged", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.enrichment.suggest, {
				...BASE_ARGS,
				name: "totally unknown merchant xyz",
			}),
		).resolves.toEqual(EMPTY);
	});
});

describe("latency/retry regression guard (task 3.13)", () => {
	test("REQUEST_TIMEOUT_MS is unchanged at 3500ms", () => {
		expect(REQUEST_TIMEOUT_MS).toBe(3500);
	});

	test("runSuggest never retries a thrown provider error (maxRetries: 0)", async () => {
		let calls = 0;
		const throwing = new MockLanguageModelV3({
			doGenerate: async () => {
				calls += 1;
				throw new Error("network down");
			},
		});

		await expect(runSuggest(throwing, BASE_ARGS)).rejects.toThrow();
		expect(calls).toBe(1);
	});
});

describe("needsGroundedLookup", () => {
	test("a confident category with no domain still needs one", () => {
		expect(
			needsGroundedLookup({ categoryName: "Groceries", domain: null }),
		).toBe(true);
	});

	test("a missing category needs one", () => {
		expect(
			needsGroundedLookup({ categoryName: null, domain: "gama.com" }),
		).toBe(true);
	});

	test("both missing needs one", () => {
		expect(needsGroundedLookup({ categoryName: null, domain: null })).toBe(
			true,
		);
	});

	test("a complete answer needs none", () => {
		expect(
			needsGroundedLookup({ categoryName: "Groceries", domain: "gama.com" }),
		).toBe(false);
	});
});

describe("maybeScheduleGrounded", () => {
	async function scheduledGroundedRuns(t: ReturnType<typeof convexTest>) {
		const rows = await t.run((ctx) =>
			ctx.db.system.query("_scheduled_functions").collect(),
		);
		return rows.filter((row) => row.name.includes("groundedLookup"));
	}

	/**
	 * `authenticatedAs` returns `AnyTestConvex` (widened for Better Auth's
	 * generic component schema — see `test.helpers.ts`), which loses this
	 * file's concrete `DataModel` and makes an inline `t.action` callback fail
	 * to typecheck against `ActionCtx`. Calling `t.withIdentity` directly on
	 * the concretely-typed `t` keeps the same runtime identity without that
	 * widening.
	 */
	function asIdentity(
		t: ReturnType<typeof convexTest>,
		identity: Awaited<ReturnType<typeof seedAuthUser>>,
	) {
		return t.withIdentity({
			subject: identity.subject,
			sessionId: identity.sessionId,
		});
	}

	test("does not schedule when the client arg is false", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await asIdentity(t, identity).run((ctx) =>
			maybeScheduleGrounded(ctx, "token-a", {
				groundedLookup: false,
				name: "Farmatodo",
				income: false,
			}),
		);

		expect(await scheduledGroundedRuns(t)).toHaveLength(0);
	});

	test("does not schedule when the synced appMeta row is false despite a true arg", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);
		await t.run((ctx) =>
			ctx.db.insert("appMeta", {
				userId: identity.userId,
				key: "groundedLookup",
				seq: 1,
				deviceId: "test-device",
				updatedAt: Date.now(),
				value: "false",
			}),
		);

		await asIdentity(t, identity).run((ctx) =>
			maybeScheduleGrounded(ctx, "token-b", {
				groundedLookup: true,
				name: "Farmatodo",
				income: false,
			}),
		);

		expect(await scheduledGroundedRuns(t)).toHaveLength(0);
	});

	test("schedules when the arg is true and no appMeta row exists", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		const scheduled = await asIdentity(t, identity).run((ctx) =>
			maybeScheduleGrounded(ctx, "token-c", {
				groundedLookup: true,
				name: "Farmatodo",
				income: false,
			}),
		);

		expect(scheduled).toBe(true);
		expect(await scheduledGroundedRuns(t)).toHaveLength(1);
	});

	test("the scheduled args never carry categoryTree (ADR-7)", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		await asIdentity(t, identity).run((ctx) =>
			maybeScheduleGrounded(ctx, "token-d", {
				groundedLookup: true,
				name: "Farmatodo",
				income: false,
				locale: "es-VE",
			}),
		);

		const [row] = await scheduledGroundedRuns(t);
		const scheduledArgs = row.args[0] as Record<string, unknown>;
		expect(scheduledArgs).not.toHaveProperty("categoryTree");
		expect(scheduledArgs).toEqual({
			key: merchantKey("Farmatodo"),
			name: "Farmatodo",
			income: false,
			locale: "es-VE",
		});
	});

	test("the scheduled args thread a region code through to groundedLookup.run", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		await asIdentity(t, identity).run((ctx) =>
			maybeScheduleGrounded(ctx, "token-e", {
				groundedLookup: true,
				name: "Farmatodo",
				income: false,
				regionCode: "VE",
			}),
		);

		const [row] = await scheduledGroundedRuns(t);
		const scheduledArgs = row.args[0] as Record<string, unknown>;
		expect(scheduledArgs.regionCode).toBe("VE");
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
		).resolves.toEqual({
			categoryName: "Streaming",
			isNewCategory: true,
			parentCategoryName: null,
			emoji: null,
			tags: ["Music", "Streaming"],
			domain: "netflix.com",
			grounding: false,
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
			categoryTree: [],
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
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
			runSuggest(model, { ...BASE_ARGS, categoryTree: [] }),
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
				categoryTree: [
					{ name: "Entertainment", children: [] },
					{ name: "Groceries", children: [] },
				],
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
				categoryTree: [
					{ name: "Entertainment", children: [] },
					{ name: "Groceries", children: [] },
				],
			}),
		).resolves.toMatchObject({
			categoryName: "Entertainment",
			isNewCategory: false,
		});
	});

	test("caps the category tree at 60 branches for the isNewCategory check", async () => {
		const categoryTree = Array.from({ length: 61 }, (_, i) => ({
			name: `Cat${i}`,
			children: [],
		}));
		// The 61st branch is pushed out of the server-side cap, so it must read as
		// "new" even though the caller technically listed it as known.
		const model = mockModel({
			categoryName: "Cat60",
			isNewCategory: false,
			parentCategoryName: null,
			emoji: null,
			tags: [],
			domain: null,
		});

		await expect(
			runSuggest(model, { ...BASE_ARGS, categoryTree }),
		).resolves.toMatchObject({ categoryName: "Cat60", isNewCategory: true });
	});

	test("keeps a parent the user actually has, for a category being created", async () => {
		const model = mockModel({
			categoryName: "Streaming",
			isNewCategory: true,
			parentCategoryName: "Entertainment",
			emoji: "📺",
			tags: [],
			domain: null,
		});

		await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
			categoryName: "Streaming",
			isNewCategory: true,
			parentCategoryName: "Entertainment",
			emoji: "📺",
		});
	});

	test("drops a parent the user does not have", async () => {
		// The model cannot know this ledger's shape, so an invented parent is not
		// taken on trust.
		const model = mockModel({
			categoryName: "Streaming",
			isNewCategory: true,
			parentCategoryName: "Invented Parent",
			emoji: null,
			tags: [],
			domain: null,
		});

		await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
			parentCategoryName: null,
		});
	});

	test("drops a parent when the category already exists", async () => {
		const model = mockModel({
			categoryName: "Entertainment",
			isNewCategory: true,
			parentCategoryName: "Groceries",
			emoji: null,
			tags: [],
			domain: null,
		});

		await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
			isNewCategory: false,
			parentCategoryName: null,
		});
	});

	test("rejects an emoji field that is really a sentence", async () => {
		const model = mockModel({
			categoryName: "Streaming",
			isNewCategory: true,
			parentCategoryName: null,
			emoji: "a television set",
			tags: [],
			domain: null,
		});

		await expect(runSuggest(model, BASE_ARGS)).resolves.toMatchObject({
			emoji: null,
		});
	});
});

describe("runSuggest regionCode", () => {
	test("threads a region code into the model prompt", async () => {
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await runSuggest(model, {
			...BASE_ARGS,
			regionCode: "VE",
			categoryTree: [],
		});

		const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
		expect(sent).toContain("VE");
	});

	test("omits any region line from the prompt when regionCode is absent", async () => {
		const model = mockModel({
			categoryName: null,
			isNewCategory: false,
			tags: [],
			domain: null,
		});

		await runSuggest(model, { ...BASE_ARGS, categoryTree: [] });

		const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
		expect(sent).not.toContain("located in region");
	});
});

describe("sanitizeDomain", () => {
	test("strips a leading www. so logo.dev's apex-only lookup still matches", () => {
		expect(sanitizeDomain("www.unicasa.com.ve")).toBe("unicasa.com.ve");
	});

	test("leaves an already-apex domain unchanged", () => {
		expect(sanitizeDomain("unicasa.com.ve")).toBe("unicasa.com.ve");
	});

	test("does not strip a host that merely starts with the letters www", () => {
		expect(sanitizeDomain("wwwfoo.com")).toBe("wwwfoo.com");
	});

	test("rejects www. alone, since nothing remains after stripping", () => {
		expect(sanitizeDomain("www.")).toBeNull();
	});

	test("case-folds before stripping, so WWW.NETFLIX.COM also loses its prefix", () => {
		expect(sanitizeDomain("WWW.NETFLIX.COM")).toBe("netflix.com");
	});
});

describe("sanitizeRegionCode", () => {
	test("uppercases a valid lowercase code", () => {
		expect(sanitizeRegionCode("ve")).toBe("VE");
	});

	test("leaves an already-uppercase code unchanged", () => {
		expect(sanitizeRegionCode("VE")).toBe("VE");
	});

	test("rejects a three-letter code", () => {
		expect(sanitizeRegionCode("VEN")).toBeUndefined();
	});

	test("rejects a code containing a digit", () => {
		expect(sanitizeRegionCode("1E")).toBeUndefined();
	});

	test("rejects an empty string", () => {
		expect(sanitizeRegionCode("")).toBeUndefined();
	});

	test("rejects a 400-character string", () => {
		expect(sanitizeRegionCode("a".repeat(400))).toBeUndefined();
	});

	test("passes undefined through unchanged", () => {
		expect(sanitizeRegionCode(undefined)).toBeUndefined();
	});
});
