/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { rateLimiter } from "./enrichment";
import { runGroundedLookup, runGroundedPasses } from "./groundedLookup";
import { budgetConfig } from "./lib/spend";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const fakeWebSearchTool = tool({
	description: "test double for xai's provider-executed web search",
	inputSchema: z.object({}),
	execute: async () => ({ query: "", sources: [] }),
});

function usageStub(inputTokens?: number, outputTokens?: number) {
	return {
		inputTokens: {
			total: inputTokens,
			noCache: undefined,
			cacheRead: undefined,
			cacheWrite: undefined,
		},
		outputTokens: {
			total: outputTokens,
			text: undefined,
			reasoning: undefined,
		},
	};
}

function mockTextModel(
	text: string,
	options?: { input?: number; output?: number; sourceUrl?: string },
) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [
				{ type: "text", text },
				...(options?.sourceUrl
					? [
							{
								type: "source" as const,
								sourceType: "url" as const,
								id: "src-1",
								url: options.sourceUrl,
							},
						]
					: []),
			],
			finishReason: { unified: "stop", raw: undefined },
			usage: usageStub(options?.input, options?.output),
			warnings: [],
		}),
	});
}

function mockObjectModel(
	payload: unknown,
	usage?: { input?: number; output?: number },
) {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: "text", text: JSON.stringify(payload) }],
			finishReason: { unified: "stop", raw: undefined },
			usage: usageStub(usage?.input, usage?.output),
			warnings: [],
		}),
	});
}

const BASE_ARGS = { key: "farmatodo", name: "Farmatodo", income: false };

describe("runGroundedPasses (ADR-1 two-pass core)", () => {
	test("pass A carries the injected tool set; pass B carries no tools key at all", async () => {
		const grounding = mockTextModel(
			"Farmatodo is a pharmacy chain in Venezuela at farmatodo.com",
		);
		const structuring = mockObjectModel({
			categoryName: "Healthcare",
			emoji: "💊",
			tags: ["pharmacy"],
			domain: "farmatodo.com",
		});

		await runGroundedPasses(
			{
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			},
			BASE_ARGS,
		);

		expect(grounding.doGenerateCalls[0]?.tools).toEqual([
			expect.objectContaining({ name: "web_search" }),
		]);
		expect(structuring.doGenerateCalls[0]?.tools).toBeUndefined();
	});

	test("neither pass retries after a thrown provider error (maxRetries: 0)", async () => {
		let calls = 0;
		const throwing = new MockLanguageModelV3({
			doGenerate: async () => {
				calls += 1;
				throw new Error("network down");
			},
		});

		await expect(
			runGroundedPasses(
				{
					grounding: throwing,
					structuring: throwing,
					groundingTools: { web_search: fakeWebSearchTool },
				},
				BASE_ARGS,
			),
		).rejects.toThrow();

		expect(calls).toBe(1);
	});

	test("pass A permits up to 4 tool-calling rounds before stopping (isStepCount(4))", async () => {
		// A CLIENT-executed tool (not `providerExecuted`) is used here purely to
		// force the SDK's step loop to continue — proving the configured cap is
		// 4, not the SDK default of 1. Production's real `web_search` tool is
		// provider-executed and asserted separately (tool-set-presence test
		// above); this test's only target is the `stopWhen` value itself.
		const loopingSearch = tool({
			description: "always requests another round",
			inputSchema: z.object({}),
			execute: async () => ({ query: "farmatodo", sources: [] }),
		});
		const grounding = new MockLanguageModelV3({
			doGenerate: async () => ({
				content: [
					{
						type: "tool-call",
						toolCallId: "call-1",
						toolName: "web_search",
						input: "{}",
					},
				],
				finishReason: { unified: "tool-calls", raw: undefined },
				usage: usageStub(10, 5),
				warnings: [],
			}),
		});
		const structuring = mockObjectModel({
			categoryName: null,
			emoji: null,
			tags: [],
			domain: null,
		});

		await runGroundedPasses(
			{ grounding, structuring, groundingTools: { web_search: loopingSearch } },
			BASE_ARGS,
		);

		expect(grounding.doGenerateCalls.length).toBe(4);
	});

	test("a confident, corroborated result becomes a published candidate", async () => {
		const grounding = mockTextModel("farmatodo.com is a pharmacy chain", {
			input: 10,
			output: 5,
			sourceUrl: "https://farmatodo.com/about",
		});
		const structuring = mockObjectModel(
			{
				categoryName: "Healthcare",
				emoji: "💊",
				tags: ["pharmacy"],
				domain: "farmatodo.com",
			},
			{ input: 20, output: 8 },
		);

		const outcome = await runGroundedPasses(
			{
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			},
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			key: "farmatodo",
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			tags: ["pharmacy"],
		});
		expect(outcome.inputTokens).toBe(30);
		expect(outcome.outputTokens).toBe(13);
	});
});

describe("runGroundedLookup guards (ADR-11 order)", () => {
	test("performs no model work when groundedPerKey is already exhausted for this key", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		await t.run((ctx) =>
			rateLimiter.limit(ctx, "groundedPerKey", { key: "farmatodo" }),
		);
		const grounding = mockTextModel("irrelevant");
		const structuring = mockObjectModel({
			categoryName: null,
			emoji: null,
			tags: [],
			domain: null,
		});

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			}),
		);

		expect(grounding.doGenerateCalls.length).toBe(0);
	});

	test("performs no model work when groundedBudgetMicros is exhausted (T7)", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const limitSpy = vi
			.spyOn(rateLimiter, "limit")
			.mockImplementation(async (_ctx, name) =>
				name === "groundedBudgetMicros"
					? { ok: false, retryAfter: 1000 }
					: { ok: true, retryAfter: undefined },
			);
		const grounding = mockTextModel("irrelevant");
		const structuring = mockObjectModel({
			categoryName: null,
			emoji: null,
			tags: [],
			domain: null,
		});

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			}),
		);

		expect(grounding.doGenerateCalls.length).toBe(0);
		limitSpy.mockRestore();
	});

	test("a confident result writes merchantKnowledge and records spend as published", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const grounding = mockTextModel("this pharmacy is confirmed", {
			input: 100,
			output: 20,
			sourceUrl: "https://farmatodo.com/about",
		});
		const structuring = mockObjectModel(
			{
				categoryName: "Healthcare",
				emoji: "💊",
				tags: ["pharmacy"],
				domain: "farmatodo.com",
			},
			{ input: 30, output: 10 },
		);

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			}),
		);

		const knowledge = await t.run((ctx) =>
			ctx.db
				.query("merchantKnowledge")
				.withIndex("by_key", (q) => q.eq("key", "farmatodo"))
				.unique(),
		);
		expect(knowledge).toMatchObject({
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			logoKey: null,
		});

		const spend = await t.run((ctx) => ctx.db.query("groundedSpend").collect());
		expect(spend).toHaveLength(1);
		expect(spend[0]).toMatchObject({ published: true });
	});

	test("an uncorroborated result records spend but writes nothing to merchantKnowledge", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const grounding = mockTextModel("no sources found");
		const structuring = mockObjectModel({
			categoryName: "Healthcare",
			emoji: "💊",
			tags: ["pharmacy"],
			domain: "farmatodo.com",
		});

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
				structuring,
				groundingTools: { web_search: fakeWebSearchTool },
			}),
		);

		const knowledge = await t.run((ctx) =>
			ctx.db
				.query("merchantKnowledge")
				.withIndex("by_key", (q) => q.eq("key", "farmatodo"))
				.unique(),
		);
		expect(knowledge).toBeNull();

		const spend = await t.run((ctx) => ctx.db.query("groundedSpend").collect());
		expect(spend).toHaveLength(1);
		expect(spend[0]).toMatchObject({ published: false });
	});
});

describe("budgetConfig integration", () => {
	test("groundedBudgetMicros is checked with the live-configured ceiling, not a static registration", () => {
		expect(budgetConfig()).toMatchObject({ kind: "fixed window", shards: 10 });
	});
});
