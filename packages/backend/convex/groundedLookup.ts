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
    DESCRIPTOR_LINE,
    placeLines,
    rateLimiter,
    sanitizeCategoryName,
    sanitizeDomain,
    sanitizeEmoji,
    sanitizeMerchantName,
    sanitizeTags,
} from "./enrichment";
import { describeTree } from "./lib/ledgerPrompt";
import type { CategoryBranch } from "./lib/ledgerPrompt";
import { CANONICAL_CATEGORY_NAMES, shouldPublish } from "./lib/merchantTrust";
import type { KnowledgeCandidate } from "./lib/merchantTrust";
import { GROK_MODEL_ID } from "./lib/models";
import { budgetConfig, estimateMicros, measureMicros } from "./lib/spend";

export const GROUNDED_REQUEST_TIMEOUT_MS = 120_000;
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
    categoryTree?: readonly CategoryBranch[];
    currency?: string;
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
    canonicalCategory: z.string().nullish(),
    categoryName: z.string().nullable(),
    domain: z.string().nullable(),
    domainConfidence: z.enum(["high", "medium", "low"]).nullish(),
    emoji: z.string().nullish(),
    merchantName: z.string().nullish(),
    tags: z.array(z.string()),
});

const UNPARSEABLE_GROUNDED_OUTPUT: z.infer<typeof groundedOutputSchema> = {
    categoryName: null,
    domain: null,
    emoji: null,
    tags: [],
};

const JSON_CONTRACT =
    '{"merchantName": string | null, "domain": string | null, "domainConfidence": "high" | "medium" | "low", "categoryName": string | null, "canonicalCategory": string | null, "emoji": string | null, "tags": string[]}';

function categoryLines(tree: readonly CategoryBranch[] | undefined): string[] {
    if (tree === undefined || tree.length === 0) {
        return [`Set categoryName to exactly one of: ${CANONICAL_NAMES_LIST}; or null if none fit confidently.`];
    }
    return [
        `Set categoryName to one of the user's categories verbatim when it fits: ${describeTree(tree)}; otherwise to a short new category name.`,
        `Set canonicalCategory to exactly one of: ${CANONICAL_NAMES_LIST}; or null if none fit confidently.`,
    ];
}

function buildGroundedPrompt(args: GroundedRunArgs): string {
    const kind = args.income ? "income" : "expense";
    return [
        `Identify the real business behind this ${kind} bank-statement transaction: "${args.name}".`,
        DESCRIPTOR_LINE,
        "Search the web as many times as you need: try the decoded name, the name with its country or city, and the legal-entity name. Confirm the business's official website before naming a domain, and never give a domain you have not seen in the results. Prefer the specific business (the shop, restaurant or chain) over the place it sits in (an airport or a mall), and name the place's operator only when the specific business cannot be identified.",
        `Respond with ONLY one JSON object, no markdown fence, no other text, shaped exactly as: ${JSON_CONTRACT}.`,
        "Set merchantName to the business's clean display name, written the way the brand itself writes it, or null when the text names no business (a person, a private note).",
        "Set domain to the apex domain of its official website, or null. Set domainConfidence to high when a search result confirms the domain, medium when it is plausible, low when you are guessing.",
        ...categoryLines(args.categoryTree),
        "Set emoji to a single emoji that suits the category, or null.",
        "Suggest at most 3 short tags.",
        args.locale ? `The user's locale is ${args.locale}.` : "",
        ...placeLines(args.regionCode, args.currency),
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

export interface GroundedAnswer {
    categoryName: string | null;
    domain: string | null;
    emoji: string | null;
    merchantName: string | null;
    tags: string[];
}

export interface GroundedCallOutcome {
    answer: GroundedAnswer;
    candidate: KnowledgeCandidate & { merchantName: string | null };
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
        prompt: buildGroundedPrompt(args),
        stopWhen: isStepCount(4),
        tools: deps.groundingTools,
    });

    const output = parseGroundedOutput(result.text);

    const sanitizedDomain = sanitizeDomain(output.domain);
    // A domain the model claims cannot be one of the image hosts this app
    // itself denylists — see `isForbiddenLogoOrigin`.
    const domain = sanitizedDomain !== null && isForbiddenLogoOrigin(sanitizedDomain) ? null : sanitizedDomain;
    const categoryName = sanitizeCategoryName(output.categoryName);
    const emoji = sanitizeEmoji(output.emoji ?? null);
    const merchantName = sanitizeMerchantName(output.merchantName ?? null);
    const tags = sanitizeTags(output.tags);

    const candidate = {
        // No user tree reaches a globally-shared record — only the closed
        // canonical set does.
        categoryName: args.categoryTree?.length ? sanitizeCategoryName(output.canonicalCategory ?? null) : categoryName,
        domain,
        emoji,
        key: args.key,
        merchantName,
        parentCategoryName: null,
        tags,
    };
    const answer: GroundedAnswer = {
        categoryName,
        domain: output.domainConfidence === "high" || output.domainConfidence === "medium" ? domain : null,
        emoji,
        merchantName,
        tags,
    };

    // `corroborates` only ever needs a url; document-type sources (no `.url`)
    // can never corroborate a domain, so they are dropped here rather than
    // widening `KnowledgeCandidate`'s source shape to accommodate them.
    const urlSources = result.sources
        .filter((source) => source.sourceType === "url")
        .map((source) => ({ url: source.url }));

    return {
        answer,
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
 * `overrideDeps` is a test-only seam — production never passes it, so the
 * real xAI provider is always constructed fresh per call
 * (`XAI_GROUNDED_MODEL_ID`/`XAI_API_KEY` read live, matching `enrichment.ts`'s
 * own rollback-lever pattern).
 */
export async function groundedAnswer(
    ctx: GroundedLookupCtx,
    args: GroundedRunArgs,
    overrideDeps?: GroundedCallDeps
): Promise<GroundedAnswer | null> {
    const estimated = estimateMicros();
    const budget = await rateLimiter.limit(ctx, "groundedBudgetMicros", {
        config: budgetConfig(),
        count: estimated,
    });
    if (!budget.ok) {
        return null;
    }

    let deps = overrideDeps;
    let modelId: string = GROK_MODEL_ID;
    if (!deps) {
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            return null;
        }
        const xaiProvider = createXai({ apiKey });
        modelId = process.env.XAI_GROUNDED_MODEL_ID || GROK_MODEL_ID;
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
        return null;
    }
    const published = shouldPublish(outcome.candidate, outcome.sources);

    if (published && outcome.candidate.domain !== null && outcome.candidate.categoryName !== null) {
        await ctx.runMutation(internal.merchantKnowledge.record, {
            categoryName: outcome.candidate.categoryName,
            domain: outcome.candidate.domain,
            emoji: outcome.candidate.emoji,
            key: outcome.candidate.key,
            merchantName: outcome.candidate.merchantName ?? undefined,
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
    return outcome.answer;
}

/**
 * Continues the same rate-limit ordering: `groundedPerKey` then
 * `groundedBudgetMicros` (both live here, never in `suggest`).
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
    await groundedAnswer(ctx, args, overrideDeps);
}

export const run = internalAction({
    args: {
        currency: v.optional(v.string()),
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
