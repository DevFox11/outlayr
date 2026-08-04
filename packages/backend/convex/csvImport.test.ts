/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "./_generated/api";
import { classify, csvImportArgs, rateLimiter } from "./csvImport";
import schema from "./schema";
import { authenticatedAs, seedAuthUser } from "./test.helpers";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
	vi.unstubAllEnvs();
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
	test("carries exactly the two privacy-boundary fields", () => {
		expect(Object.keys(csvImportArgs).sort()).toEqual(
			["categoryTree", "labels"].sort(),
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
				{ label: "Coffee Shop", categoryName: "Coffee" },
				{ label: "Unknown Store", categoryName: "Groceries" },
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
			suggestions: [{ label: "Coffee Shop", categoryName: "Coffee" }],
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
