import { createXai } from "@ai-sdk/xai";
import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { optionalUserId } from "./lib/auth";
import { merchantKey } from "./lib/merchantKey";

/**
 * `grok-4-fast-non-reasoning` and `grok-3-mini` — the original design's pick
 * and fallback — do not exist in this account's model lineup (`GET
 * https://api.x.ai/v1/models`). Measured live against a real
 * merchant-extraction prompt: the `grok-4.20-0309` non-reasoning snapshot
 * settled in 841ms with correct structured output; `grok-4.5` took 2.69s.
 * `grok-4.5` is kept here only as the documented too-slow fallback — it is
 * never selected automatically. `XAI_MODEL_ID` overrides the primary id
 * without a deploy. Exported so `groundedLookup.ts` shares the same default.
 */
export const ENRICHMENT_MODEL_ID = "grok-4.20-non-reasoning";
export const ENRICHMENT_FALLBACK_MODEL_ID = "grok-4.5";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;
const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 24;
const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_DOMAIN_LENGTH = 253;
const MAX_KNOWN_CATEGORY_NAMES = 60;
/** The action's own budget under the client's 4s `Promise.race` abort. */
export const REQUEST_TIMEOUT_MS = 3500;
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/**
 * The action's only arguments — a privacy boundary, not just a shape.
 * Amounts, dates, accounts, balances, and identity must never appear here;
 * only the merchant name and the user's own category names may leave the
 * device. Exported so `enrichment.test.ts` can assert the field count
 * directly rather than re-deriving it from the wrapped action.
 */
export const suggestArgs = {
    categoryTree: v.array(v.object({ children: v.array(v.string()), name: v.string() })),
    /**
     * One side of the dual-authority consent gate. A forged `true` alone
     * cannot enable a grounded lookup — the synced `appMeta` row must also
     * agree — but a `false` always blocks, from either side.
     */
    groundedLookup: v.boolean(),
    income: v.boolean(),
    knowledgeOnly: v.optional(v.boolean()),
    locale: v.optional(v.string()),
    name: v.string(),
    /**
     * The device's own region — a signal `locale` cannot substitute for, since a
     * user may run an English UI on a device set to a different region.
     * Sanitized before use (`sanitizeRegionCode`); it never carries anything but
     * a bare ISO 3166-1 alpha-2 code.
     */
    regionCode: v.optional(v.string()),
};

const suggestion = v.object({
    categoryName: v.union(v.string(), v.null()),
    domain: v.union(v.string(), v.null()),
    emoji: v.union(v.string(), v.null()),
    /** A grounded lookup was scheduled — the client must not cache this as a final null result. */
    grounding: v.boolean(),
    isNewCategory: v.boolean(),
    /** Set only when the suggestion belongs under an existing category. */
    parentCategoryName: v.union(v.string(), v.null()),
    tags: v.array(v.string()),
});

export interface CategoryBranch {
    children: string[];
    name: string;
}

export interface Suggestion {
    categoryName: string | null;
    domain: string | null;
    emoji: string | null;
    grounding: boolean;
    isNewCategory: boolean;
    parentCategoryName: string | null;
    tags: string[];
}

export const EMPTY: Suggestion = {
    categoryName: null,
    domain: null,
    emoji: null,
    grounding: false,
    isNewCategory: false,
    parentCategoryName: null,
    tags: [],
};

/** The model's own output is untrusted input — this is only the JSON shape. */
const modelOutputSchema = z.object({
    categoryName: z.string().nullable(),
    domain: z.string().nullable(),
    emoji: z.string().nullish(),
    isNewCategory: z.boolean(),
    // Nullish rather than nullable: a model that simply omits one of these has
    // still answered the question that matters, and failing the whole call over
    // a missing optional field would cost the category and tags too.
    parentCategoryName: z.string().nullish(),
    tags: z.array(z.string()),
});

/**
 * Keyed by `identity.tokenIdentifier`, per the repo's Convex guidelines
 * (preferred over `subject`), never a client argument. Checked before the
 * global limit — it is the common rejection, so checking it first keeps
 * abusive traffic off the sharded global counter.
 *
 * Exported so `enrichment.test.ts` can pre-consume a bucket directly rather
 * than racing the component's random shard sampling through the action.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
    // An unsharded global counter is one hot document and throws OCC write
    // conflicts under concurrency — `shards: 10` is load-bearing, not tuning.
    enrichmentGlobal: {
        kind: "fixed window",
        period: HOUR,
        rate: 2000,
        shards: 10,
    },
    enrichmentPerUser: {
        capacity: 8,
        kind: "token bucket",
        period: HOUR,
        rate: 30,
    },
    // Kills both a user retyping the same unknown name and a
    // thundering herd across many users hitting one new merchant at once.
    // Checked inside `groundedLookup.run`, never here.
    groundedPerKey: {
        capacity: 1,
        kind: "token bucket",
        period: DAY,
        rate: 1,
    },
    // Checked in `suggest` itself, before the internal action is ever
    // scheduled. This gate is anti-abuse, NOT cost control — `groundedBudgetMicros`
    // is the real backstop, and `groundedPerKey` already stops the same merchant
    // being looked up twice in a day. At 5/day it fired during ordinary use: a
    // user in an uncovered country hits five unknown merchants in one sitting and
    // is then locked out for hours, which is exactly the person this feature is
    // for.
    groundedPerUser: {
        capacity: 20,
        kind: "token bucket",
        period: DAY,
        rate: 100,
    },
});

export function sanitizeTags(tags: readonly string[]): string[] {
    return tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, MAX_TAGS)
        .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
}

/**
 * Rejects anything that is not a bare `host.tld`-shaped string — this is what
 * stops a hallucinated `https://…` url or a bare `netflix` from ever reaching
 * the logo fetcher. Case-folded before the match so `NETFLIX.COM`
 * survives; the pattern itself only accepts lowercase.
 */
export function sanitizeDomain(domain: string | null): string | null {
    if (domain === null) {
        return null;
    }
    const trimmed = domain.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_DOMAIN_LENGTH) {
        return null;
    }
    // Measured: the grounded lookup returns `www.`-prefixed domains, which
    // logo.dev's apex-only lookup would otherwise miss.
    const apex = trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
    return DOMAIN_PATTERN.test(apex) ? apex : null;
}

export function sanitizeCategoryName(name: string | null): string | null {
    if (name === null) {
        return null;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
        return null;
    }
    return trimmed;
}

const REGION_CODE_PATTERN = /^[A-Z]{2}$/;

/**
 * ISO 3166-1 alpha-2 only. This is client-submitted input, not model output —
 * a modified client could send anything here, so it is validated the same way
 * `trimmedName`'s length bounds are, before it ever reaches a prompt.
 */
export function sanitizeRegionCode(region: string | undefined): string | undefined {
    if (region === undefined) {
        return;
    }
    const trimmed = region.trim().toUpperCase();
    return REGION_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

function describeTree(tree: readonly CategoryBranch[]): string {
    if (tree.length === 0) {
        return "none";
    }
    return tree
        .map((branch) =>
            branch.children.length > 0 ? `${branch.name} (containing ${branch.children.join(", ")})` : branch.name
        )
        .join("; ");
}

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

function buildPrompt(
    name: string,
    income: boolean,
    locale: string | undefined,
    regionCode: string | undefined,
    tree: readonly CategoryBranch[]
): string {
    const kind = income ? "income" : "expense";
    return [
        `Classify this ${kind} transaction merchant name: "${name}".`,
        `The user's categories, with any nested under them, are: ${describeTree(tree)}.`,
        "Reuse one of those names verbatim when it fits, and set parentCategoryName to null.",
        "Otherwise suggest a short new category name. If it clearly belongs beneath one of the user's existing top-level categories, set parentCategoryName to that name exactly; if it stands on its own, set parentCategoryName to null.",
        "Set emoji to a single emoji that suits the category, or null.",
        "Suggest at most 3 short tags, and the merchant's primary web domain only if you are confident of it (otherwise null).",
        locale ? `The user's locale is ${locale}.` : "",
        regionLine(regionCode),
    ]
        .filter((line) => line.length > 0)
        .join(" ");
}

export interface RunSuggestArgs {
    categoryTree: readonly CategoryBranch[];
    income: boolean;
    locale?: string;
    name: string;
    regionCode?: string;
}

/**
 * At most a couple of glyphs. A model asked for "a single emoji" will now and
 * then answer with a sentence, and that would end up rendered as a category's
 * symbol.
 */
export function sanitizeEmoji(emoji: string | null): string | null {
    if (emoji === null) {
        return null;
    }
    const trimmed = emoji.trim();
    if (trimmed.length === 0 || [...trimmed].length > 3) {
        return null;
    }
    return PICTOGRAPHIC.test(trimmed) ? trimmed : null;
}

export interface TreeCandidate {
    categoryName: string | null;
    domain: string | null;
    emoji: string | null;
    parentCategoryName: string | null;
    tags: readonly string[];
}

/**
 * Resolves a candidate's `isNewCategory`/`parentCategoryName` against one
 * user's own category tree. Shared by `runSuggest` (Tier 2, tree-relative
 * from the start) and `suggest`'s Tier 1.5 cache hit (a globally-shared
 * candidate applied to whichever user is asking this time) — the same
 * merchant can be "new" for one user and already-known for another.
 */
export function applyToTree(tree: readonly CategoryBranch[], candidate: TreeCandidate): Omit<Suggestion, "grounding"> {
    const cappedTree = tree.slice(0, MAX_KNOWN_CATEGORY_NAMES);
    const everyName = cappedTree.flatMap((branch) => [branch.name, ...branch.children]);

    const { categoryName } = candidate;
    const isNewCategory = categoryName !== null && !everyName.includes(categoryName);
    // A parent is only ever one of the top-level names actually sent, and only
    // for a category being created. Anything else is dropped rather than
    // trusted — neither the model nor a globally-shared cache row can know
    // this particular user's ledger shape.
    const parentCategoryName =
        isNewCategory &&
        candidate.parentCategoryName !== null &&
        candidate.parentCategoryName !== categoryName &&
        cappedTree.some((branch) => branch.name === candidate.parentCategoryName)
            ? candidate.parentCategoryName
            : null;

    return {
        categoryName,
        domain: candidate.domain,
        emoji: candidate.emoji,
        isNewCategory,
        parentCategoryName,
        tags: [...candidate.tags],
    };
}

/**
 * Model call + sanitisation only — no auth, no env check, no rate limit.
 * Exported so tests can inject a fake model directly; the guard ladder above
 * it is exercised through the `suggest` action instead.
 */
export async function runSuggest(model: LanguageModel, args: RunSuggestArgs): Promise<Suggestion> {
    const tree = args.categoryTree.slice(0, MAX_KNOWN_CATEGORY_NAMES);

    const { output } = await generateText({
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // The SDK default is 2 retries, which alone would triple worst-case
        // latency past the client's own 4s `Promise.race` abort.
        maxRetries: 0,
        model,
        output: Output.object({ schema: modelOutputSchema }),
        prompt: buildPrompt(args.name, args.income, args.locale, args.regionCode, tree),
    });

    return {
        // The model's own `isNewCategory` claim is discarded by `applyToTree` —
        // it has no reason to be authoritative about the user's own local data.
        ...applyToTree(args.categoryTree, {
            categoryName: sanitizeCategoryName(output.categoryName),
            domain: sanitizeDomain(output.domain),
            emoji: sanitizeEmoji(output.emoji ?? null),
            parentCategoryName: sanitizeCategoryName(output.parentCategoryName ?? null),
            tags: sanitizeTags(output.tags),
        }),
        grounding: false,
    };
}

const GROUNDED_LOOKUP_META_KEY = "groundedLookup";

/**
 * The server-side half of the dual-authority gate: the synced `appMeta`
 * row, keyed the same way `sync.ts` writes it (the Better Auth user id, NOT
 * `identity.tokenIdentifier` — those are different id spaces in this app).
 * An absent row defaults to consented, matching `SETTING_DEFAULTS.groundedLookup`
 * on the client — a device that has never synced this key has never
 * turned it off.
 *
 * A caller whose session no longer resolves answers false rather than throwing:
 * `csvImport.ts` schedules grounded lookups mid-action, and `use-csv-import.tsx`
 * reports any rejection from that action as "You're offline".
 */
export const groundedConsent = internalQuery({
    args: {},
    handler: async (ctx) => {
        const userId = await optionalUserId(ctx);
        if (userId === null) {
            return false;
        }
        const row = await ctx.db
            .query("appMeta")
            .withIndex("by_user_and_key", (q) => q.eq("userId", userId).eq("key", GROUNDED_LOOKUP_META_KEY))
            .unique();
        return row === null || row.value !== "false";
    },
    returns: v.boolean(),
});

export interface GroundedScheduleArgs {
    groundedLookup: boolean;
    income: boolean;
    locale?: string;
    name: string;
    regionCode?: string;
}

/**
 * The least ctx capability this needs — `Pick` rather than the full
 * `ActionCtx` so a `convex-test` `t.run` mutation-shaped ctx (which carries
 * the same `runQuery`/`runMutation`/`scheduler` signatures) can exercise this
 * function directly in tests, concretely typed, with no widening cast.
 */
export type GroundedScheduleCtx = Pick<ActionCtx, "runQuery" | "runMutation" | "scheduler">;

/**
 * A missing domain is as much a miss as a missing category. The model can
 * infer "Supermercados X" is groceries from the name alone, but it cannot
 * invent a regional chain's domain — so the answer that most needs a grounded
 * search is the one that already has a category and no url.
 */
export function needsGroundedLookup(result: Pick<Suggestion, "categoryName" | "domain">): boolean {
    return result.categoryName === null || result.domain === null;
}

/**
 * Rate limiting order: `groundedPerUser` here, `groundedPerKey` and
 * `groundedBudgetMicros` inside `groundedLookup.run` itself. Returns whether a
 * lookup was actually scheduled, so `suggest` knows whether to report
 * `grounding: true`. `categoryTree` is deliberately not a parameter —
 * the scheduled args below can never carry it.
 */
export async function maybeScheduleGrounded(
    ctx: GroundedScheduleCtx,
    tokenIdentifier: string,
    args: GroundedScheduleArgs
): Promise<boolean> {
    if (!args.groundedLookup) {
        return false;
    }
    const consented = await ctx.runQuery(internal.enrichment.groundedConsent, {});
    if (!consented) {
        return false;
    }
    const gate = await rateLimiter.limit(ctx, "groundedPerUser", {
        key: tokenIdentifier,
    });
    if (!gate.ok) {
        return false;
    }
    await ctx.scheduler.runAfter(0, internal.groundedLookup.run, {
        income: args.income,
        key: merchantKey(args.name),
        locale: args.locale,
        name: args.name,
        regionCode: args.regionCode,
    });
    return true;
}

/**
 * Read live rather than through `@outlayr/env/backend`'s frozen snapshot, so
 * that `npx convex env set XAI_API_KEY=""` (design rollback lever 2) takes
 * effect on the very next call — matching `auth.ts`'s `resolveSiteUrl`.
 */
export const suggest = action({
    args: suggestArgs,
    handler: async (ctx, args): Promise<Suggestion> => {
        const identity = await ctx.auth.getUserIdentity();
        if (identity === null) {
            return EMPTY;
        }

        const trimmedName = args.name.trim();
        if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
            return EMPTY;
        }

        const regionCode = sanitizeRegionCode(args.regionCode);

        // Tier 1.5: an indexed read that costs nothing and consumes neither rate
        // limit bucket below — checked before `XAI_API_KEY` so a hit still works
        // even when that key is unset (design's degradation matrix).
        const cached = await ctx.runQuery(internal.merchantKnowledge.lookup, {
            key: merchantKey(trimmedName),
        });
        if (cached !== null) {
            return {
                ...applyToTree(args.categoryTree, cached),
                grounding: false,
            };
        }

        if (args.knowledgeOnly === true) {
            return EMPTY;
        }

        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
            return EMPTY;
        }

        const perUser = await rateLimiter.limit(ctx, "enrichmentPerUser", {
            key: identity.tokenIdentifier,
        });
        if (!perUser.ok) {
            return EMPTY;
        }

        const global = await rateLimiter.limit(ctx, "enrichmentGlobal");
        if (!global.ok) {
            return EMPTY;
        }

        try {
            const xaiProvider = createXai({ apiKey });
            const modelId = process.env.XAI_MODEL_ID || ENRICHMENT_MODEL_ID;
            const result = await runSuggest(xaiProvider(modelId), {
                categoryTree: args.categoryTree,
                income: args.income,
                locale: args.locale,
                name: trimmedName,
                regionCode,
            });

            // A missing domain counts as a miss, not just a missing category. The
            // model can infer "Supermercados X" is groceries from the name alone,
            // but it cannot invent a regional chain's domain — so the case that
            // most needs a grounded search is the one that still has a category.
            // Scheduling is never awaited: it fills Tier 1.5 for the NEXT lookup
            // of this merchant, never this transaction.
            if (result.categoryName === null || result.domain === null) {
                const scheduled = await maybeScheduleGrounded(ctx, identity.tokenIdentifier, {
                    groundedLookup: args.groundedLookup,
                    income: args.income,
                    locale: args.locale,
                    name: trimmedName,
                    regionCode,
                });
                // Whatever the model did answer is kept — blanking it would throw
                // away a good category to report a missing logo. `grounding: true`
                // is what stops the client caching this as final.
                if (scheduled) {
                    return { ...result, grounding: true };
                }
            }
            return result;
        } catch (error) {
            console.warn(
                `[enrichment] xAI call threw for "${trimmedName}":`,
                error instanceof Error ? `${error.name}: ${error.message}` : String(error)
            );
            // A rejected xAI call surfaces here as a normal degradation, not a
            // thrown ConvexError — throwing would fill function logs with stack
            // traces for an entirely ordinary timeout or provider outage.
            return EMPTY;
        }
    },
    returns: suggestion,
});
