// oxlint-disable unicorn/filename-case -- the Convex module name is the function path — this file is addressed as internal.groundedLookup.run by callers and by jobs already queued in _scheduled_functions

import { createXai } from "@ai-sdk/xai";
import { generateText, isStepCount } from "ai";
import type { LanguageModel, ToolSet } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import {
    ENRICHMENT_MODEL_ID,
    rateLimiter,
    sanitizeCategoryName,
    sanitizeDomain,
    sanitizeEmoji,
    sanitizeTags,
} from "./enrichment";
import { CANONICAL_CATEGORY_NAMES, shouldPublish } from "./lib/merchantTrust";
import type { KnowledgeCandidate } from "./lib/merchantTrust";
import { budgetConfig, estimateMicros, measureMicros } from "./lib/spend";

export const GROUNDED_REQUEST_TIMEOUT_MS = 25_000;
const CANONICAL_NAMES_LIST = [...CANONICAL_CATEGORY_NAMES].join(", ");

/**
 * The model can hallucinate one of its own denylisted image hosts as a
 * merchant's domain (e.g. `img.logo.dev`) — that domain still reaches the
 * client's favicon tier, so it is nulled out here rather than only guarding a
 * fetch that no longer exists.
 */
const FORBIDDEN_LOGO_ORIGINS = [/(^|\.)logo\.dev$/i, /(^|\.)itunes\.apple\.com$/i, /(^|\.)mzstatic\.com$/i];

const FENCED_JSON = /```(?:json)?\s*([\s\S]*?)```/i;

function isForbiddenLogoOrigin(domain: string): boolean {
    return FORBIDDEN_LOGO_ORIGINS.some((pattern) => pattern.test(domain));
}

export interface GroundedRunArgs {
    income: boolean;
    key: string;
    locale?: string;
    name: string;
    regionCode?: string;
}

export interface GroundedCallDeps {
    grounding: LanguageModel;
    groundingTools: ToolSet;
}

const groundedOutputSchema = z.object({
    categoryName: z.string().nullable(),
    domain: z.string().nullable(),
    emoji: z.string().nullish(),
    tags: z.array(z.string()),
});

const UNPARSEABLE_GROUNDED_OUTPUT: z.infer<typeof groundedOutputSchema> = {
    categoryName: null,
    domain: null,
    emoji: null,
    tags: [],
};

const JSON_SHAPE = '{"categoryName": string | null, "emoji": string | null, "tags": string[], "domain": string | null}';

/**
 * `regionCode` beats a same-named business elsewhere without licensing a
 * guess: the model is told to prefer a merchant operating there, never to
 * invent one when nothing actually matches.
 */
function regionLine(regionCode: string | undefined): string {
    return regionCode
        ? `The user is in region ${regionCode}. If this name matches businesses in more than one country, prefer one operating in ${regionCode} over a same-named business elsewhere. If no business operating in ${regionCode} matches, fall back to the best globally known match for this name. Do not guess a match if none fits confidently.`
        : "";
}

/** No `categoryTree` parameter anywhere in this file — structurally, not by convention. */
function buildGroundedPrompt(
    name: string,
    income: boolean,
    locale: string | undefined,
    regionCode: string | undefined
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
    const fenced = text.match(FENCED_JSON);
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
function parseGroundedOutput(text: string): z.infer<typeof groundedOutputSchema> {
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
    inputTokens: number;
    outputTokens: number;
    searchCalls: number;
    sources: readonly { url: string }[];
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
    args: GroundedRunArgs
): Promise<GroundedCallOutcome> {
    const result = await generateText({
        abortSignal: AbortSignal.timeout(GROUNDED_REQUEST_TIMEOUT_MS),
        maxRetries: 0,
        model: deps.grounding,
        prompt: buildGroundedPrompt(args.name, args.income, args.locale, args.regionCode),
        stopWhen: isStepCount(4),
        tools: deps.groundingTools,
    });

    const output = parseGroundedOutput(result.text);

    const sanitizedDomain = sanitizeDomain(output.domain);

    const candidate: KnowledgeCandidate = {
        // No user tree exists for a globally-shared record — the model
        // is asked to pick from the closed canonical set instead.
        categoryName: sanitizeCategoryName(output.categoryName),
        // A domain the model claims cannot be one of the image hosts this app
        // itself denylists — see `isForbiddenLogoOrigin`.
        domain: sanitizedDomain !== null && isForbiddenLogoOrigin(sanitizedDomain) ? null : sanitizedDomain,
        emoji: sanitizeEmoji(output.emoji ?? null),
        key: args.key,
        parentCategoryName: null,
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
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        // `web_search` is the only registered tool, so every recorded call is a
        // search round. One answer measured at 3 search calls — bills ~3x a
        // naive per-lookup estimate ($0.022 measured vs $0.005 assumed).
        searchCalls: result.toolCalls.length,
        sources: urlSources,
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
    overrideDeps?: GroundedCallDeps
): Promise<void> {
    const perKey = await rateLimiter.limit(ctx, "groundedPerKey", {
        key: args.key,
    });
    if (!perKey.ok) {
        return;
    }

    const estimated = estimateMicros();
    const budget = await rateLimiter.limit(ctx, "groundedBudgetMicros", {
        config: budgetConfig(),
        count: estimated,
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
        modelId = process.env.XAI_GROUNDED_MODEL_ID || process.env.XAI_MODEL_ID || ENRICHMENT_MODEL_ID;
        const model = xaiProvider(modelId);
        deps = {
            grounding: model,
            groundingTools: { web_search: xaiProvider.tools.webSearch() },
        };
    }

    let outcome: GroundedCallOutcome;
    try {
        outcome = await runGroundedLookupCall(deps, args);
    } catch (error) {
        console.warn(
            `[groundedLookup] call threw for "${args.key}":`,
            error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        );
        await ctx.runMutation(internal.groundedSpend.record, {
            actualMicros: 0,
            at: Date.now(),
            chargedMicros: estimated,
            inputTokens: 0,
            outputTokens: 0,
            published: false,
            searchCalls: 0,
        });
        return;
    }
    const published = shouldPublish(outcome.candidate, outcome.sources);

    if (published && outcome.candidate.domain !== null && outcome.candidate.categoryName !== null) {
        await ctx.runMutation(internal.merchantKnowledge.record, {
            categoryName: outcome.candidate.categoryName,
            domain: outcome.candidate.domain,
            emoji: outcome.candidate.emoji,
            key: outcome.candidate.key,
            modelId,
            parentCategoryName: null,
            resolvedAt: Date.now(),
            tags: [...outcome.candidate.tags],
        });
    }

    // Spend is recorded unconditionally, even when the result never cleared
    // `shouldPublish`.
    await ctx.runMutation(internal.groundedSpend.record, {
        actualMicros: measureMicros(
            { inputTokens: outcome.inputTokens, outputTokens: outcome.outputTokens },
            outcome.searchCalls
        ),
        at: Date.now(),
        chargedMicros: estimated,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        published,
        searchCalls: outcome.searchCalls,
    });
}

export const run = internalAction({
    args: {
        income: v.boolean(),
        key: v.string(),
        locale: v.optional(v.string()),
        name: v.string(),
        regionCode: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await runGroundedLookup(ctx, args);
        return null;
    },
    returns: v.null(),
});
