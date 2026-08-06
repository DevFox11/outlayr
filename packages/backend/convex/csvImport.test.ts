/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import {
	classify,
	csvImportArgs,
	GROUNDED_IMPORT_MAX,
	rateLimiter,
	scheduleImportGrounded,
} from "./csvImport";
import { merchantKey } from "./lib/merchantKey";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function mockModel(text: string) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text", text }],
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

function rejectingModel(error: Error) {
	return new MockLanguageModelV3({
		doGenerate: async () => {
			throw error;
		},
	});
}

const BASE_ARGS = {
	labels: ["Coffee Shop", "Unknown Store"],
	categoryTree: [
		{ name: "Food", children: ["Coffee"] },
		{ name: "Groceries", children: [] },
	],
};

describe("csvImportArgs", () => {
	test("carries exactly the privacy-boundary fields — labels, tree, consent, region", () => {
		expect(Object.keys(csvImportArgs).sort()).toEqual(
			["categoryTree", "groundedLookup", "labels", "regionCode"].sort(),
		);
	});
});

describe("csvImport guard ladder", () => {
	test("returns unauthenticated for a signed-out caller", async () => {
		const t = convexTest(schema, modules);

		await expect(t.action(api.csvImport.csvImport, BASE_ARGS)).resolves.toEqual(
			{ status: "unauthenticated", suggestions: null },
		);
	});

	test("returns notConfigured when XAI_API_KEY is unset, never throws", async () => {
		vi.stubEnv("XAI_API_KEY", "");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, BASE_ARGS),
		).resolves.toEqual({ status: "notConfigured", suggestions: null });
	});

	test("returns invalid when there are no labels to classify", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, {
				...BASE_ARGS,
				labels: [],
			}),
		).resolves.toEqual({ status: "invalid", suggestions: null });
	});

	test("returns invalid when labels exceed the 200-label cap", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, {
				...BASE_ARGS,
				labels: Array.from({ length: 201 }, (_, i) => `Merchant ${i}`),
			}),
		).resolves.toEqual({ status: "invalid", suggestions: null });
	});

	test("returns rateLimited and never throws once the per-user bucket is exhausted", async () => {
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

		await t.run(async (ctx) =>
			rateLimiter.limit(ctx, "csvImportPerUser", {
				key: tokenIdentifier,
				count: 2,
			}),
		);

		await expect(
			asUser.action(api.csvImport.csvImport, BASE_ARGS),
		).resolves.toEqual({ status: "rateLimited", suggestions: null });
	});

	test("returns rateLimited and never throws once the global window is exhausted", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const limitSpy = vi
			.spyOn(rateLimiter, "limit")
			.mockImplementation(async (_ctx, name) =>
				name === "csvImportGlobal"
					? { ok: false, retryAfter: 1000 }
					: { ok: true, retryAfter: undefined },
			);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, BASE_ARGS),
		).resolves.toEqual({ status: "rateLimited", suggestions: null });
		expect(limitSpy).toHaveBeenCalledWith(expect.anything(), "csvImportGlobal");
	});
});

async function scheduledGroundedRuns(t: ReturnType<typeof convexTest>) {
	const rows = await t.run((ctx) =>
		ctx.db.system.query("_scheduled_functions").collect(),
	);
	return rows.filter((row) => row.name.includes("groundedLookup"));
}

function asIdentity(
	t: ReturnType<typeof convexTest>,
	identity: Awaited<ReturnType<typeof seedAuthUser>>,
) {
	return t.withIdentity({
		subject: identity.subject,
		sessionId: identity.sessionId,
	});
}

describe("scheduleImportGrounded", () => {
	test("schedules one grounded run per label, deduped by merchant key", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		const scheduled = await asIdentity(t, identity).run((ctx) =>
			scheduleImportGrounded(ctx, "token-import-a", {
				labels: ["Corpoelec", "CORPOELEC!!", "Automercado Plaza's"],
				groundedLookup: true,
				regionCode: "VE",
			}),
		);

		expect(scheduled).toBe(2);
		const runs = await scheduledGroundedRuns(t);
		expect(runs).toHaveLength(2);
		const argsByKey = new Map(
			runs.map((run) => {
				const scheduledArgs = run.args[0] as Record<string, unknown>;
				return [scheduledArgs.key, scheduledArgs];
			}),
		);
		expect(argsByKey.get(merchantKey("Corpoelec"))).toEqual({
			key: "corpoelec",
			name: "Corpoelec",
			income: false,
			regionCode: "VE",
		});
		expect(argsByKey.get(merchantKey("Automercado Plaza's"))).toEqual({
			key: "automercado plaza s",
			name: "Automercado Plaza's",
			income: false,
			regionCode: "VE",
		});
	});

	test("caps one import's grounded attempts at GROUNDED_IMPORT_MAX", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		const labels = Array.from(
			{ length: GROUNDED_IMPORT_MAX + 2 },
			(_, i) => `Unknown Merchant ${"x".repeat(i + 1)}`,
		);
		const scheduled = await asIdentity(t, identity).run((ctx) =>
			scheduleImportGrounded(ctx, "token-import-b", {
				labels,
				groundedLookup: true,
			}),
		);

		expect(scheduled).toBe(GROUNDED_IMPORT_MAX);
		expect(await scheduledGroundedRuns(t)).toHaveLength(GROUNDED_IMPORT_MAX);
	});

	test("schedules nothing when the client consent flag is false", async () => {
		const t = convexTest(schema, modules);
		const identity = await seedAuthUser(t);

		const scheduled = await asIdentity(t, identity).run((ctx) =>
			scheduleImportGrounded(ctx, "token-import-c", {
				labels: ["Corpoelec"],
				groundedLookup: false,
			}),
		);

		expect(scheduled).toBe(0);
		expect(await scheduledGroundedRuns(t)).toHaveLength(0);
	});

	test("schedules nothing when the synced appMeta consent row is false", async () => {
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

		const scheduled = await asIdentity(t, identity).run((ctx) =>
			scheduleImportGrounded(ctx, "token-import-d", {
				labels: ["Corpoelec"],
				groundedLookup: true,
			}),
		);

		expect(scheduled).toBe(0);
		expect(await scheduledGroundedRuns(t)).toHaveLength(0);
	});
});

describe("merchantKnowledge tier", () => {
	test("answers a known label from merchantKnowledge with its stored domain, without the model", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);
		await t.run((ctx) =>
			ctx.db.insert("merchantKnowledge", {
				key: "farmacia saas",
				domain: "farmaciasaas.com",
				categoryName: "Healthcare",
				parentCategoryName: null,
				emoji: null,
				tags: ["Pharmacy"],
				resolvedAt: Date.now(),
				modelId: "test-model",
			}),
		);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, {
				labels: ["FARMACIA SAAS"],
				categoryTree: [{ name: "Healthcare", children: [] }],
			}),
		).resolves.toEqual({
			status: "ok",
			suggestions: [
				{
					label: "FARMACIA SAAS",
					categoryName: "Healthcare",
					domain: "farmaciasaas.com",
				},
			],
		});
		expect(await scheduledGroundedRuns(t)).toHaveLength(0);
	});

	test("an unknown label schedules a grounded lookup even when the model tier fails", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response('{"error":"unauthorized"}', {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
			),
		);
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);

		const result = await authenticatedAs(t, identity).action(
			api.csvImport.csvImport,
			{
				labels: ["Corpoelec"],
				categoryTree: [{ name: "Utilities", children: [] }],
				groundedLookup: true,
				regionCode: "VE",
			},
		);

		expect(result.status).toBe("providerError");
		const runs = await scheduledGroundedRuns(t);
		expect(runs).toHaveLength(1);
		expect((runs[0].args[0] as Record<string, unknown>).key).toBe("corpoelec");
	});

	test("keeps knowledge-tier suggestions when the model tier fails on a mixed batch", async () => {
		vi.stubEnv("XAI_API_KEY", "test-xai-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response('{"error":"unauthorized"}', {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
			),
		);
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const identity = await seedAuthUser(t);
		await t.run((ctx) =>
			ctx.db.insert("merchantKnowledge", {
				key: "farmacia saas",
				domain: "farmaciasaas.com",
				categoryName: "Healthcare",
				parentCategoryName: null,
				emoji: null,
				tags: ["Pharmacy"],
				resolvedAt: Date.now(),
				modelId: "test-model",
			}),
		);

		await expect(
			authenticatedAs(t, identity).action(api.csvImport.csvImport, {
				labels: ["FARMACIA SAAS", "Unknown Store"],
				categoryTree: [{ name: "Healthcare", children: [] }],
			}),
		).resolves.toEqual({
			status: "ok",
			degraded: true,
			suggestions: [
				{
					label: "FARMACIA SAAS",
					categoryName: "Healthcare",
					domain: "farmaciasaas.com",
				},
			],
		});
	});
});

describe("classify", () => {
	test("returns ok with a suggestion for every label naming an existing category", async () => {
		const model = mockModel(
			JSON.stringify({
				mapping: [
					{ label: "Coffee Shop", categoryName: "Coffee" },
					{ label: "Unknown Store", categoryName: "Groceries" },
				],
			}),
		);

		await expect(
			classify(model, {
				labels: BASE_ARGS.labels,
				categoryTree: BASE_ARGS.categoryTree,
			}),
		).resolves.toEqual({
			status: "ok",
			suggestions: [
				{ label: "Coffee Shop", categoryName: "Coffee", domain: null },
				{ label: "Unknown Store", categoryName: "Groceries", domain: null },
			],
		});
	});

	test("drops only the label naming a category the user does not have, the rest still apply", async () => {
		const model = mockModel(
			JSON.stringify({
				mapping: [
					{ label: "Coffee Shop", categoryName: "Coffee" },
					{ label: "Unknown Store", categoryName: "Invented Category" },
				],
			}),
		);

		await expect(
			classify(model, {
				labels: BASE_ARGS.labels,
				categoryTree: BASE_ARGS.categoryTree,
			}),
		).resolves.toEqual({
			status: "ok",
			suggestions: [
				{ label: "Coffee Shop", categoryName: "Coffee", domain: null },
			],
		});
	});

	test("returns invalidResponse with an empty label array for schema-invalid JSON", async () => {
		const model = mockModel("this is not json at all");

		await expect(
			classify(model, {
				labels: BASE_ARGS.labels,
				categoryTree: BASE_ARGS.categoryTree,
			}),
		).resolves.toEqual({
			status: "invalidResponse",
			suggestions: null,
		});
	});

	test("returns providerError, never throws, when the model rejects", async () => {
		const model = rejectingModel(new Error("network down"));

		await expect(
			classify(model, {
				labels: BASE_ARGS.labels,
				categoryTree: BASE_ARGS.categoryTree,
			}),
		).resolves.toEqual({
			status: "providerError",
			suggestions: null,
		});
	});
});
