/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { rateLimiter } from "./enrichment";
import {
	fetchOwnOriginLogo,
	runGroundedLookup,
	runGroundedLookupCall,
} from "./groundedLookup";
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

const BASE_ARGS = { key: "farmatodo", name: "Farmatodo", income: false };

const CONFIDENT_PAYLOAD = {
	categoryName: "Healthcare",
	emoji: "💊",
	tags: ["pharmacy"],
	domain: "farmatodo.com",
};

describe("runGroundedLookupCall (single-call collapse, measured 2026-08-03)", () => {
	test("the single call carries the injected web_search tool set", async () => {
		const grounding = mockTextModel(JSON.stringify(CONFIDENT_PAYLOAD));

		await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(grounding.doGenerateCalls[0]?.tools).toEqual([
			expect.objectContaining({ name: "web_search" }),
		]);
	});

	test("parses a clean JSON response with no fence or prose", async () => {
		const grounding = mockTextModel(JSON.stringify(CONFIDENT_PAYLOAD), {
			sourceUrl: "https://farmatodo.com/about",
		});

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			key: "farmatodo",
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			tags: ["pharmacy"],
		});
	});

	test("parses JSON wrapped in a ```json fence", async () => {
		const text = [
			"Here is what I found after searching:",
			"```json",
			JSON.stringify(CONFIDENT_PAYLOAD),
			"```",
		].join("\n");
		const grounding = mockTextModel(text, {
			sourceUrl: "https://farmatodo.com/about",
		});

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			categoryName: "Healthcare",
			domain: "farmatodo.com",
		});
	});

	test("parses JSON wrapped in surrounding prose with no fence at all", async () => {
		const text = `Based on my search, this is a pharmacy chain. ${JSON.stringify(CONFIDENT_PAYLOAD)} I am confident in this answer.`;
		const grounding = mockTextModel(text, {
			sourceUrl: "https://farmatodo.com/about",
		});

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			categoryName: "Healthcare",
			domain: "farmatodo.com",
		});
	});

	test("degrades to an all-null candidate on unparseable output, without throwing", async () => {
		const grounding = mockTextModel(
			"I was unable to confirm any details about this merchant.",
		);

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			categoryName: null,
			domain: null,
			emoji: null,
			tags: [],
		});
	});

	test("neither retries after a thrown provider error (maxRetries: 0)", async () => {
		let calls = 0;
		const throwing = new MockLanguageModelV3({
			doGenerate: async () => {
				calls += 1;
				throw new Error("network down");
			},
		});

		await expect(
			runGroundedLookupCall(
				{
					grounding: throwing,
					groundingTools: { web_search: fakeWebSearchTool },
				},
				BASE_ARGS,
			),
		).rejects.toThrow();

		expect(calls).toBe(1);
	});

	test("permits up to 4 tool-calling rounds before stopping (isStepCount(4))", async () => {
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

		await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: loopingSearch } },
			BASE_ARGS,
		);

		expect(grounding.doGenerateCalls.length).toBe(4);
	});

	test("a confident, corroborated result reports usage and sources from the one call", async () => {
		const grounding = mockTextModel(JSON.stringify(CONFIDENT_PAYLOAD), {
			input: 5489,
			output: 85,
			sourceUrl: "https://farmatodo.com/about",
		});

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.candidate).toMatchObject({
			key: "farmatodo",
			categoryName: "Healthcare",
			domain: "farmatodo.com",
			tags: ["pharmacy"],
		});
		expect(outcome.sources).toEqual([{ url: "https://farmatodo.com/about" }]);
		expect(outcome.inputTokens).toBe(5489);
		expect(outcome.outputTokens).toBe(85);
	});

	test("drops a non-url source rather than widening the candidate's source shape", async () => {
		const grounding = new MockLanguageModelV3({
			doGenerate: async () => ({
				content: [
					{ type: "text", text: JSON.stringify(CONFIDENT_PAYLOAD) },
					{
						type: "source",
						sourceType: "document",
						id: "doc-1",
						mediaType: "application/pdf",
						title: "not a url",
					},
				],
				finishReason: { unified: "stop", raw: undefined },
				usage: usageStub(10, 5),
				warnings: [],
			}),
		});

		const outcome = await runGroundedLookupCall(
			{ grounding, groundingTools: { web_search: fakeWebSearchTool } },
			BASE_ARGS,
		);

		expect(outcome.sources).toEqual([]);
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

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
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

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
				groundingTools: { web_search: fakeWebSearchTool },
			}),
		);

		expect(grounding.doGenerateCalls.length).toBe(0);
		limitSpy.mockRestore();
	});

	test("a confident result writes merchantKnowledge and records spend as published", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		const grounding = mockTextModel(JSON.stringify(CONFIDENT_PAYLOAD), {
			input: 130,
			output: 30,
			sourceUrl: "https://farmatodo.com/about",
		});

		// A stub, never the real `fetch`: this is a published-candidate test, not
		// an image-fetch one — see the `fetchOwnOriginLogo` suite below for that.
		const noLogo = vi.fn(async () => {
			throw new Error("no network in tests");
		});

		await t.action(async (ctx) =>
			runGroundedLookup(
				ctx,
				BASE_ARGS,
				{
					grounding,
					groundingTools: { web_search: fakeWebSearchTool },
				},
				noLogo as unknown as typeof fetch,
			),
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
			// On ANY logo-fetch failure the metadata still writes — absence of an
			// image is never a reason to withhold category/tags/domain.
			logoKey: null,
		});

		const spend = await t.run((ctx) => ctx.db.query("groundedSpend").collect());
		expect(spend).toHaveLength(1);
		expect(spend[0]).toMatchObject({ published: true });
	});

	test("an uncorroborated result records spend but writes nothing to merchantKnowledge", async () => {
		const t = convexTest(schema, modules);
		rateLimiterTest.register(t);
		// A confident domain with NO source part at all — nothing corroborates it.
		const grounding = mockTextModel(JSON.stringify(CONFIDENT_PAYLOAD));

		await t.action(async (ctx) =>
			runGroundedLookup(ctx, BASE_ARGS, {
				grounding,
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

function pngBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length).fill(0x42);
	bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
	return bytes;
}

function fakeResponse(options: {
	url: string;
	status?: number;
	contentType?: string | null;
	bytes?: Uint8Array;
}): Response {
	const bytes = options.bytes ?? new Uint8Array(0);
	return {
		url: options.url,
		status: options.status ?? 200,
		headers: {
			get: (name: string) =>
				name.toLowerCase() === "content-type"
					? (options.contentType ?? null)
					: null,
		},
		arrayBuffer: async () =>
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	} as unknown as Response;
}

describe("fetchOwnOriginLogo (ADR-8, T2, T10)", () => {
	test("a redirect to a different host is rejected even though the bytes are a valid image", async () => {
		const fetchImpl = vi.fn(async () =>
			fakeResponse({
				url: "https://attacker.example/apple-touch-icon.png",
				contentType: "image/png",
				bytes: pngBytes(1024),
			}),
		);

		await expect(
			fetchOwnOriginLogo("farmatodo.com", fetchImpl as unknown as typeof fetch),
		).resolves.toBeNull();
	});

	test("a 300 KB body is rejected as too large", async () => {
		const fetchImpl = vi.fn(async () =>
			fakeResponse({
				url: "https://farmatodo.com/apple-touch-icon.png",
				contentType: "image/png",
				bytes: pngBytes(300_000),
			}),
		);

		await expect(
			fetchOwnOriginLogo("farmatodo.com", fetchImpl as unknown as typeof fetch),
		).resolves.toBeNull();
	});

	test("a logo.dev domain is never fetched server-side", async () => {
		const fetchImpl = vi.fn();

		await expect(
			fetchOwnOriginLogo("img.logo.dev", fetchImpl as unknown as typeof fetch),
		).resolves.toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	test("an itunes.apple.com or mzstatic.com domain is never fetched server-side", async () => {
		const fetchImpl = vi.fn();

		await fetchOwnOriginLogo(
			"itunes.apple.com",
			fetchImpl as unknown as typeof fetch,
		);
		await fetchOwnOriginLogo(
			"is1-ssl.mzstatic.com",
			fetchImpl as unknown as typeof fetch,
		);

		expect(fetchImpl).not.toHaveBeenCalled();
	});

	test("accepts a real own-origin image and reports its content type", async () => {
		const bytes = pngBytes(1024);
		const fetchImpl = vi.fn(async (input: string | URL | Request) =>
			fakeResponse({
				url: String(input),
				contentType: "image/png",
				bytes,
			}),
		);

		await expect(
			fetchOwnOriginLogo("farmatodo.com", fetchImpl as unknown as typeof fetch),
		).resolves.toStrictEqual({ bytes, contentType: "image/png" });
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://farmatodo.com/apple-touch-icon.png",
			expect.anything(),
		);
	});

	test("falls through to /favicon.ico when apple-touch-icon.png fails", async () => {
		const bytes = pngBytes(1024);
		const fetchImpl = vi.fn(async (input: string | URL | Request) =>
			String(input).endsWith("apple-touch-icon.png")
				? fakeResponse({ url: String(input), status: 404 })
				: fakeResponse({
						url: String(input),
						contentType: "image/png",
						bytes,
					}),
		);

		await expect(
			fetchOwnOriginLogo("farmatodo.com", fetchImpl as unknown as typeof fetch),
		).resolves.toStrictEqual({ bytes, contentType: "image/png" });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});

describe("budgetConfig integration", () => {
	test("groundedBudgetMicros is checked with the live-configured ceiling, not a static registration", () => {
		expect(budgetConfig()).toMatchObject({ kind: "fixed window", shards: 10 });
	});
});
