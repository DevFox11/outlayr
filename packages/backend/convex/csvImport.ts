// oxlint-disable unicorn/filename-case -- the Convex module name is the function path — clients call this action as api.csvImport.csvImport

import { createXai } from "@ai-sdk/xai";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { generateText, NoObjectGeneratedError, Output, TypeValidationError } from "ai";
import type { LanguageModel } from "ai";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { maybeScheduleGrounded, sanitizeRegionCode } from "./enrichment";
import type { GroundedScheduleCtx } from "./enrichment";
import { describeTree } from "./lib/ledgerPrompt";
import type { CategoryBranch } from "./lib/ledgerPrompt";
import { perUserBurst } from "./lib/limits";
import { merchantKey } from "./lib/merchantKey";
import { GROK_MODEL_ID } from "./lib/models";
import { isPro } from "./revenuecat";

const MAX_LABELS = 200;
/** The action's own budget under the client's 15s hard `Promise.race` abort. */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * The action's only arguments — a privacy boundary asserted by test, not just
 * a shape. `import-ai-payload.ts`'s `ClassificationPayload` plus the grounded
 * consent flag and device region: no raw file, no full row set, no amount or
 * date value, and no per-row data of any kind may reach here.
 */
export const csvImportArgs = {
    categoryTree: v.array(v.object({ children: v.array(v.string()), name: v.string() })),
    /** One side of the dual-authority consent gate — see `enrichment.ts:suggestArgs`. */
    groundedLookup: v.optional(v.boolean()),
    labels: v.array(v.string()),
    regionCode: v.optional(v.string()),
};

const labelSuggestion = v.object({
    categoryName: v.string(),
    domain: v.union(v.string(), v.null()),
    label: v.string(),
});

const csvImportStatus = v.union(
    v.literal("ok"),
    v.literal("unauthenticated"),
    v.literal("notConfigured"),
    v.literal("rateLimited"),
    v.literal("notEntitled"),
    v.literal("invalid"),
    v.literal("providerError"),
    v.literal("invalidResponse")
);

const csvImportResult = v.object({
    degraded: v.optional(v.boolean()),
    status: csvImportStatus,
    suggestions: v.union(v.array(labelSuggestion), v.null()),
});

export interface LabelSuggestion {
    categoryName: string;
    domain: string | null;
    label: string;
}

export type CsvImportStatus = Infer<typeof csvImportStatus>;

export interface CsvImportResult {
    degraded?: boolean;
    status: CsvImportStatus;
    suggestions: LabelSuggestion[] | null;
}

function failure(status: Exclude<CsvImportStatus, "ok">): CsvImportResult {
    return { status, suggestions: null };
}

/** The model's own output is untrusted input — this is only the JSON shape. */
const modelOutputSchema = z.object({
    mapping: z.array(
        z.object({
            categoryName: z.string().nullable(),
            label: z.string(),
        })
    ),
});

export interface RunClassifyArgs {
    categoryTree: readonly CategoryBranch[];
    labels: readonly string[];
}

function buildPrompt(args: RunClassifyArgs): string {
    return [
        "Classify each of these transaction labels into one of the user's existing categories.",
        `Labels: ${args.labels.join(", ")}.`,
        `The user's categories, with any nested under them, are: ${describeTree(args.categoryTree)}.`,
        "For each label, respond with mapping entries of { label, categoryName }. Reuse one of the listed category names verbatim, or set categoryName to null when none fit. Never invent a new category name.",
    ].join(" ");
}

/**
 * `shards: 10` is copied from `enrichment.ts:118` and is load-bearing — an
 * unsharded global counter is one hot document and throws OCC write conflicts
 * under concurrency.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
    csvImportGlobal: {
        kind: "fixed window",
        period: HOUR,
        rate: 200,
        shards: 10,
    },
});

/**
 * Model call, sanitisation, and failure classification only — no auth, no env
 * check, no rate limit. Exported so tests can inject a fake `LanguageModel`
 * directly, since the real xAI provider cannot be substituted through the
 * wrapped `csvImport` action.
 */
export async function classify(model: LanguageModel, args: RunClassifyArgs): Promise<CsvImportResult> {
    try {
        const { output } = await generateText({
            abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            // The SDK default is 2 retries, which alone would blow past the
            // client's own 15s `Promise.race` abort.
            maxRetries: 0,
            model,
            output: Output.object({ schema: modelOutputSchema }),
            prompt: buildPrompt(args),
            reasoning: "low",
        });

        const known = new Set(args.categoryTree.flatMap((branch) => [branch.name, ...branch.children]));

        const suggestions: LabelSuggestion[] = [];
        for (const item of output.mapping) {
            const categoryName = item.categoryName?.trim();
            // The model cannot know this ledger's shape: a name it invents is
            // dropped rather than trusted, and dropping it is not a schema
            // failure — the rest of a well-formed response still applies.
            if (!(categoryName && known.has(categoryName))) {
                continue;
            }
            suggestions.push({ categoryName, domain: null, label: item.label });
        }

        return { status: "ok", suggestions };
    } catch (error) {
        if (NoObjectGeneratedError.isInstance(error) || TypeValidationError.isInstance(error)) {
            // The model's JSON failed schema validation: the whole response is
            // untrustworthy, so zero suggestions are applied rather than
            // sanitising per field.
            return failure("invalidResponse");
        }
        return failure("providerError");
    }
}

/**
 * One import may burn at most this many grounded-lookup attempts. The
 * `groundedPerUser` bucket bursts at 20, so a single big import of unknowns
 * spends at most half of it; the remainder of the batch degrades to
 * classify-with-null-domain and is picked up by a later import once the
 * scheduled lookups have filled `merchantKnowledge`.
 */
export const GROUNDED_IMPORT_MAX = 10;

export interface ImportGroundedArgs {
    groundedLookup: boolean;
    labels: readonly string[];
    regionCode?: string;
}

/**
 * Fire-and-forget learning: each scheduled `groundedLookup.run` fills
 * `merchantKnowledge` for the NEXT import of that merchant, never this one —
 * the same contract as `enrichment.ts:suggest`. Consent is pre-checked once
 * here so a declined user costs one query, not one per label;
 * `maybeScheduleGrounded` re-checks it per label, which is just an indexed
 * read. `income: false` because the batch payload deliberately carries no
 * per-row data to derive it from.
 */
export async function scheduleImportGrounded(
    ctx: GroundedScheduleCtx,
    tokenIdentifier: string,
    args: ImportGroundedArgs
): Promise<number> {
    if (!args.groundedLookup) {
        return 0;
    }
    const consented = await ctx.runQuery(internal.enrichment.groundedConsent, {});
    if (!consented) {
        return 0;
    }
    const seen = new Set<string>();
    let attempts = 0;
    let scheduled = 0;
    for (const label of args.labels) {
        if (attempts >= GROUNDED_IMPORT_MAX) {
            break;
        }
        const key = merchantKey(label);
        if (key.length === 0 || seen.has(key)) {
            continue;
        }
        seen.add(key);
        attempts += 1;
        // oxlint-disable-next-line no-await-in-loop -- maybeScheduleGrounded spends one token of the shared groundedPerUser rate limit per call (enrichment.ts:435); running them in parallel races that counter and admits a different number of labels
        const ok = await maybeScheduleGrounded(ctx, tokenIdentifier, {
            groundedLookup: true,
            income: false,
            name: label,
            regionCode: args.regionCode,
        });
        if (ok) {
            scheduled += 1;
        }
    }
    return scheduled;
}

/**
 * Read live rather than through a frozen snapshot, so that
 * `npx convex env set XAI_API_KEY=""` takes effect on the very next call.
 */
export const csvImport = action({
    args: csvImportArgs,
    handler: async (ctx, args): Promise<CsvImportResult> => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            return failure("unauthenticated");
        }

        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            return failure("notConfigured");
        }

        if (args.labels.length === 0 || args.labels.length > MAX_LABELS) {
            return failure("invalid");
        }

        if (!(await isPro(ctx, identity.subject))) {
            return failure("notEntitled");
        }

        const perUser = await rateLimiter.limit(ctx, "csvImportPerUser", {
            config: perUserBurst("csvImport", true),
            key: identity.tokenIdentifier,
        });
        if (!perUser.ok) {
            return failure("rateLimited");
        }

        const global = await rateLimiter.limit(ctx, "csvImportGlobal");
        if (!global.ok) {
            return failure("rateLimited");
        }

        // Tier 1.5, after the rate limits so the shared table cannot be probed
        // faster than the model could be. A knowledge row answers with the same
        // category and domain `enrichment.ts:suggest` would return, so its label
        // never reaches the model.
        const known: LabelSuggestion[] = [];
        const remaining: string[] = [];
        const looked = await Promise.all(
            args.labels.map(async (label) => ({
                label,
                row: await ctx.runQuery(internal.merchantKnowledge.lookup, { key: merchantKey(label) }),
            }))
        );
        for (const { label, row } of looked) {
            if (row === null) {
                remaining.push(label);
            } else {
                known.push({
                    categoryName: row.categoryName,
                    domain: row.domain,
                    label,
                });
            }
        }
        // Scheduled before the model call so a provider failure still learns the
        // batch's unknown merchants for next time.
        await scheduleImportGrounded(ctx, identity.tokenIdentifier, {
            groundedLookup: args.groundedLookup === true,
            labels: remaining,
            regionCode: sanitizeRegionCode(args.regionCode),
        });

        if (remaining.length === 0) {
            return { status: "ok", suggestions: known };
        }

        const xaiProvider = createXai({ apiKey });
        const modelId = process.env.XAI_MODEL_ID || GROK_MODEL_ID;
        const classified = await classify(xaiProvider(modelId), {
            categoryTree: args.categoryTree,
            labels: remaining,
        });
        if (classified.status !== "ok" || classified.suggestions === null) {
            if (known.length > 0) {
                return { degraded: true, status: "ok", suggestions: known };
            }
            return classified;
        }
        return { status: "ok", suggestions: [...known, ...classified.suggestions] };
    },
    returns: csvImportResult,
});
