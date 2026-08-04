import { createXai } from "@ai-sdk/xai";
import {
	generateText,
	isStepCount,
	type LanguageModel,
	type ToolSet,
} from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { type ActionCtx, internalAction } from "./_generated/server";
import {
	ENRICHMENT_MODEL_ID,
	rateLimiter,
	sanitizeCategoryName,
	sanitizeDomain,
	sanitizeEmoji,
	sanitizeTags,
} from "./enrichment";
import {
	CANONICAL_CATEGORY_NAMES,
	type KnowledgeCandidate,
	shouldPublish,
} from "./lib/merchantTrust";
import { budgetConfig, estimateMicros, measureMicros } from "./lib/spend";

/** Same worst-case budget as Tier 2 — off the typing path, so no client race depends on it. */
const GROUNDED_REQUEST_TIMEOUT_MS = 3500;
const CANONICAL_NAMES_LIST = [...CANONICAL_CATEGORY_NAMES].join(", ");

/**
 * The model can hallucinate one of its own denylisted image hosts as a
 * merchant's domain (e.g. `img.logo.dev`) — that domain still reaches the
 * client's favicon tier, so it is nulled out here rather than only guarding a
 * fetch that no longer exists.
 */
const FORBIDDEN_LOGO_ORIGINS = [
	/(^|\.)logo\.dev$/i,
	/(^|\.)itunes\.apple\.com$/i,
	/(^|\.)mzstatic\.com$/i,
];

function isForbiddenLogoOrigin(domain: string): boolean {
	return FORBIDDEN_LOGO_ORIGINS.some((pattern) => pattern.test(domain));
}

export interface GroundedRunArgs {
	key: string;
	name: string;
	income: boolean;
	locale?: string;
	regionCode?: string;
}

export interface GroundedCallDeps {
	grounding: LanguageModel;
	groundingTools: ToolSet;
}

const groundedOutputSchema = z.object({
	categoryName: z.string().nullable(),
	emoji: z.string().nullish(),
	tags: z.array(z.string()),
	domain: z.string().nullable(),
});

const UNPARSEABLE_GROUNDED_OUTPUT: z.infer<typeof groundedOutputSchema> = {
	categoryName: null,
	emoji: null,
	tags: [],
	domain: null,
};

const JSON_SHAPE =
	'{"categoryName": string | null, "emoji": string | null, "tags": string[], "domain": string | null}';

/**
 * `regionCode` beats a same-named business elsewhere without licensing a
 * guess: the model is told to prefer a merchant operating there, never to
 * invent one when nothing actually matches.
 */
function regionLine(regionCode: string | undefined): string {
	return regionCode
		? `The user is in region ${regionCode}. If this name matches businesses in more than one country, prefer one operating in ${regionCode} over a same-named business elsewhere. Do not guess a match if none fits confidently.`
		: "";
}

/** No `categoryTree` parameter anywhere in this file — structurally, not by convention. */
function buildGroundedPrompt(
	name: string,
	income: boolean,
	locale: string | undefined,
	regionCode: string | undefined,
): string {
	const kind = income ? "income" : "expense";
	return [
		`Identify this real-world ${kind} merchant or business: "${name}".`,
		"Use web search to confirm its primary website domain before answering.",
		`Respond with ONLY one JSON object, no markdown fence, no other text, shaped exactly as: ${JSON_SHAPE}.`,
		`Set categoryName to exactly one of: ${CANONICAL_NAMES_LIST}; or null if none fit confidently.`,
		"Set emoji to a single emoji that suits the category, or null.",
		"Suggest at most 3 short tags, and its primary web domain only if a search result confirms it, else null.",
		locale ? `The user's locale is ${locale}.` : "",
		regionLine(regionCode),
	]
		.filter((line) => line.length > 0)
		.join(" ");
}

/**
 * The model may answer with clean JSON, a fenced ```json block, or JSON
 * wrapped in prose — this never throws, matching the measured live call
 * (a single `generateText` with `web_search` returned JSON text directly).
 */
function extractJsonCandidate(text: string): string | null {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		return fenced[1].trim();
	}
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		return null;
	}
	return text.slice(start, end + 1);
}

/**
 * An unparseable answer degrades to all-null fields rather than throwing —
 * exactly like a confident "I don't know" from the model would.
 */
function parseGroundedOutput(
	text: string,
): z.infer<typeof groundedOutputSchema> {
	const jsonText = extractJsonCandidate(text);
	if (jsonText === null) {
		return UNPARSEABLE_GROUNDED_OUTPUT;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(jsonText);
	} catch {
		return UNPARSEABLE_GROUNDED_OUTPUT;
	}
	const parsed = groundedOutputSchema.safeParse(raw);
	return parsed.success ? parsed.data : UNPARSEABLE_GROUNDED_OUTPUT;
}

export interface GroundedCallOutcome {
	candidate: KnowledgeCandidate;
	sources: readonly { url: string }[];
	inputTokens: number;
	outputTokens: number;
	searchCalls: number;
}

/**
 * Collapsed from the original two-pass design: a live measured call
 * against `grok-4.20-non-reasoning` with `web_search` returned clean JSON
 * text while searching (3 search steps, 3.75s), disproving the "structured
 * output can't compose with a provider tool" assumption that motivated the
 * split — the JSON shape is instructed in the prompt and parsed defensively
 * instead of relying on an `Output.object` response format. No ctx, no rate
 * limiting, no writes — testable by injecting the model and tool set
 * directly. `stopWhen: isStepCount(4)` still allows multiple search rounds;
 * `maxRetries: 0` matches the inline tier.
 */
export async function runGroundedLookupCall(
	deps: GroundedCallDeps,
	args: GroundedRunArgs,
): Promise<GroundedCallOutcome> {
	const result = await generateText({
		model: deps.grounding,
		tools: deps.groundingTools,
		stopWhen: isStepCount(4),
		prompt: buildGroundedPrompt(
			args.name,
			args.income,
			args.locale,
			args.regionCode,
		),
		abortSignal: AbortSignal.timeout(GROUNDED_REQUEST_TIMEOUT_MS),
		maxRetries: 0,
	});

	const output = parseGroundedOutput(result.text);

	const sanitizedDomain = sanitizeDomain(output.domain);

	const candidate: KnowledgeCandidate = {
		key: args.key,
		// A domain the model claims cannot be one of the image hosts this app
		// itself denylists — see `isForbiddenLogoOrigin`.
		domain:
			sanitizedDomain !== null && isForbiddenLogoOrigin(sanitizedDomain)
				? null
				: sanitizedDomain,
		// No user tree exists for a globally-shared record — the model
		// is asked to pick from the closed canonical set instead.
		categoryName: sanitizeCategoryName(output.categoryName),
		parentCategoryName: null,
		emoji: sanitizeEmoji(output.emoji ?? null),
		tags: sanitizeTags(output.tags),
	};

	// `corroborates` only ever needs a url; document-type sources (no `.url`)
	// can never corroborate a domain, so they are dropped here rather than
	// widening `KnowledgeCandidate`'s source shape to accommodate them.
	const urlSources = result.sources
		.filter((source) => source.sourceType === "url")
		.map((source) => ({ url: source.url }));

	return {
		candidate,
		sources: urlSources,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
		// `web_search` is the only registered tool, so every recorded call is a
		// search round. One answer measured at 3 search calls — bills ~3x a
		// naive per-lookup estimate ($0.022 measured vs $0.005 assumed).
		searchCalls: result.toolCalls.length,
	};
}

/**
 * The least ctx capability this needs — see `enrichment.ts`'s
 * `GroundedScheduleCtx` for why `Pick` rather than the full `ActionCtx`.
 */
export type GroundedLookupCtx = Pick<ActionCtx, "runQuery" | "runMutation">;

/**
 * Continues the same rate-limit ordering: `groundedPerKey` then
 * `groundedBudgetMicros` (both live here, never in `suggest`).
 * `overrideDeps` is a test-only seam — production never passes it, so the
 * real xAI provider is always constructed fresh per call
 * (`XAI_GROUNDED_MODEL_ID`/`XAI_API_KEY` read live, matching `enrichment.ts`'s
 * own rollback-lever pattern).
 */
export async function runGroundedLookup(
	ctx: GroundedLookupCtx,
	args: GroundedRunArgs,
	overrideDeps?: GroundedCallDeps,
): Promise<void> {
	const perKey = await rateLimiter.limit(ctx, "groundedPerKey", {
		key: args.key,
	});
	if (!perKey.ok) {
		return;
	}

	const estimated = estimateMicros();
	const budget = await rateLimiter.limit(ctx, "groundedBudgetMicros", {
		count: estimated,
		config: budgetConfig(),
	});
	if (!budget.ok) {
		return;
	}

	let deps = overrideDeps;
	let modelId: string = ENRICHMENT_MODEL_ID;
	if (!deps) {
		const apiKey = process.env.XAI_API_KEY;
		if (!apiKey) {
			return;
		}
		const xaiProvider = createXai({ apiKey });
		modelId =
			process.env.XAI_GROUNDED_MODEL_ID ||
			process.env.XAI_MODEL_ID ||
			ENRICHMENT_MODEL_ID;
		const model = xaiProvider(modelId);
		deps = {
			grounding: model,
			groundingTools: { web_search: xaiProvider.tools.webSearch() },
		};
	}

	const outcome = await runGroundedLookupCall(deps, args);
	const published = shouldPublish(outcome.candidate, outcome.sources);

	if (
		published &&
		outcome.candidate.domain !== null &&
		outcome.candidate.categoryName !== null
	) {
		await ctx.runMutation(internal.merchantKnowledge.record, {
			key: outcome.candidate.key,
			domain: outcome.candidate.domain,
			categoryName: outcome.candidate.categoryName,
			parentCategoryName: null,
			emoji: outcome.candidate.emoji,
			tags: [...outcome.candidate.tags],
			resolvedAt: Date.now(),
			modelId,
		});
	}

	// Spend is recorded unconditionally, even when the result never cleared
	// `shouldPublish`.
	await ctx.runMutation(internal.groundedSpend.record, {
		at: Date.now(),
		chargedMicros: estimated,
		actualMicros: measureMicros(
			{ inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens },
			outcome.searchCalls,
		),
		searchCalls: outcome.searchCalls,
		inputTokens: outcome.inputTokens,
		outputTokens: outcome.outputTokens,
		published,
	});
}

export const run = internalAction({
	args: {
		key: v.string(),
		name: v.string(),
		income: v.boolean(),
		locale: v.optional(v.string()),
		regionCode: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await runGroundedLookup(ctx, args);
		return null;
	},
});
