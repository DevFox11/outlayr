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
import { PICKABLE_CURRENCY_CODES } from "./lib/currencies";
import { describeTree } from "./lib/ledgerPrompt";
import type { CategoryBranch } from "./lib/ledgerPrompt";
import { perUserBurst } from "./lib/limits";
import { knowledgeKey } from "./lib/merchantKey";
import { DOMAIN_PATTERN, MAX_DOMAIN_LENGTH, MAX_TAG_LENGTH, MAX_TAGS, PICTOGRAPHIC } from "./lib/sanitizeLimits";
import { isPro } from "./revenuecat";

/**
 * `grok-4-fast-non-reasoning` and `grok-3-mini` — the original design's pick
 * and fallback — do not exist in this account's model lineup (`GET
 * https://api.x.ai/v1/models`). Measured live against a real
 * merchant-extraction prompt: the `grok-4.20-0309` non-reasoning snapshot
 * settled in 841ms with correct structured output; `grok-4.5` took 2.69s.
 * `XAI_MODEL_ID` overrides the primary id without a deploy. Exported so
 * `groundedLookup.ts` shares the same default.
 */
export const ENRICHMENT_MODEL_ID = "grok-4.20-non-reasoning";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;
const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_KNOWN_CATEGORY_NAMES = 60;
/** The action's own budget under the client's 4s `Promise.race` abort. */
export const REQUEST_TIMEOUT_MS = 3500;

/**
 * The action's only arguments — a privacy boundary, not just a shape.
 * Amounts, dates, accounts, balances, and identity must never appear here;
 * only the merchant name and the user's own category names may leave the
 * device. Exported so `enrichment.test.ts` can assert the field count
 * directly rather than re-deriving it from the wrapped action.
 */
export const suggestArgs = {
    background: v.optional(v.boolean()),
    categoryTree: v.array(v.object({ children: v.array(v.string()), name: v.string() })),
    /**
     * The ISO 4217 code the purchase was charged in — a code, never an amount.
     * It is the one signal that survives travel: a device set to VE buying in
     * EUR is in Europe, and `regionCode` alone would point the model the wrong
     * way. Sanitized before use (`sanitizeCurrencyCode`).
     */
    currency: v.optional(v.string()),
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

const DOMAIN_CONFIDENCE = ["high", "medium", "low"] as const;

function domainAccepted(confidence: (typeof DOMAIN_CONFIDENCE)[number] | null | undefined): boolean {
    return confidence === "high" || confidence === "medium";
}

/** The model's own output is untrusted input — this is only the JSON shape. */
const modelOutputSchema = z.object({
    /**
     * Never read. Asking the model to write the brand's own name before its
     * domain is what measurably fixes the domain's spelling: on 13 hyphenated
     * or regional merchants x 10 runs, correct domains rose from 88 to 106 of
     * 130 (with the spelling sentence in `DOMAIN_LINE`), against 96 for that
     * sentence alone.
     */
    brand: z.string().nullish(),
    categoryName: z.string().nullable(),
    domain: z.string().nullable(),
    /**
     * Asked for alongside the domain so the prompt can demand a best guess
     * without the guess reaching the logo fetcher: only `high` or `medium`
     * keeps the domain in `runSuggest`. Nullish so a model that omits it still
     * answers the category — the domain alone is what it forfeits.
     */
    domainConfidence: z.enum(DOMAIN_CONFIDENCE).nullish(),
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
    enrichmentBackground: perUserBurst("enrichmentBackground", false),
    // An unsharded global counter is one hot document and throws OCC write
    // conflicts under concurrency — `shards: 10` is load-bearing, not tuning.
    enrichmentGlobal: {
        kind: "fixed window",
        period: HOUR,
        rate: 2000,
        shards: 10,
    },
    enrichmentPerUser: perUserBurst("enrichment", false),
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

const KNOWN_CURRENCIES: ReadonlySet<string> = new Set(PICKABLE_CURRENCY_CODES);

/**
 * A currency the app can actually pick, not merely three letters. Client-
 * submitted, and it partitions the shared knowledge cache and the per-key
 * grounded gate, so an arbitrary string here would be a fresh partition and
 * a fresh search allowance each time.
 */
export function sanitizeCurrencyCode(currency: string | undefined): string | undefined {
    if (currency === undefined) {
        return;
    }
    const trimmed = currency.trim().toUpperCase();
    return KNOWN_CURRENCIES.has(trimmed) ? trimmed : undefined;
}

/**
 * What a merchant name actually looks like when it arrives. A Wallet
 * automation and a bank statement both hand over the card-terminal descriptor,
 * and "Sushi Way Les Ha" is a truncated "Sushi Way Les Halles", not a business
 * the model has never heard of.
 */
export const DESCRIPTOR_LINE =
    "The name is usually a card-terminal or bank-statement descriptor: it may be truncated, abbreviated, uppercase, or carry a city, country or store number.";

/**
 * Measured against the live model: "only if you are confident" answered null
 * for Intermarché, Stradivarius and Île-de-France Mobilités, whose logos the
 * image tiers had all along. Asking for the best guess plus a confidence and
 * dropping only `low` resolved every one of those, while a person's name or a
 * private note still comes back null.
 */
export const DOMAIN_LINE =
    "Set brand to the business's official name written the way the brand itself writes it, or null. Set domain to the primary web domain of the brand you recognise (a chain, retailer, restaurant group, transit operator, utility, service or app): the apex domain of its main site, never a subdomain. Write the domain exactly as the brand's own website address is spelled, keeping hyphens, digits, dots and country suffixes; it is often not the brand name with spaces, accents and punctuation removed (for example coca-cola.com, hm.com, bahn.de). Set domainConfidence to high when you recognise the brand, medium when it is a plausible match, low when you are guessing. Set domain to null only when the name does not identify any specific business you know of (a person, a private note, an unknown local shop).";

/**
 * Where the purchase happened outranks where the device is registered. The
 * device region only breaks ties between same-named businesses.
 */
export function placeLines(regionCode: string | undefined, currency: string | undefined): string[] {
    return [
        currency ? `The purchase was charged in ${currency}, which indicates where the merchant operates.` : "",
        regionCode
            ? `The user's device region is ${regionCode}, but they may be travelling. If this name matches businesses in more than one country, prefer one operating in ${regionCode} unless the currency says otherwise; if no business operating in ${regionCode} matches, fall back to the best globally known match for this name.`
            : "",
    ];
}

function buildPrompt(
    name: string,
    income: boolean,
    locale: string | undefined,
    regionCode: string | undefined,
    currency: string | undefined,
    tree: readonly CategoryBranch[]
): string {
    const kind = income ? "income" : "expense";
    return [
        `Classify this ${kind} transaction merchant name: "${name}".`,
        DESCRIPTOR_LINE,
        `The user's categories, with any nested under them, are: ${describeTree(tree)}.`,
        "Reuse one of those names verbatim when it fits, and set parentCategoryName to null.",
        "Otherwise suggest a short new category name. If it clearly belongs beneath one of the user's existing top-level categories, set parentCategoryName to that name exactly; if it stands on its own, set parentCategoryName to null.",
        "Set emoji to a single emoji that suits the category, or null.",
        "Suggest at most 3 short tags.",
        DOMAIN_LINE,
        locale ? `The user's locale is ${locale}.` : "",
        ...placeLines(regionCode, currency),
    ]
        .filter((line) => line.length > 0)
        .join(" ");
}

export interface RunSuggestArgs {
    categoryTree: readonly CategoryBranch[];
    currency?: string;
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
        prompt: buildPrompt(args.name, args.income, args.locale, args.regionCode, args.currency, tree),
    });

    return {
        // The model's own `isNewCategory` claim is discarded by `applyToTree` —
        // it has no reason to be authoritative about the user's own local data.
        ...applyToTree(args.categoryTree, {
            categoryName: sanitizeCategoryName(output.categoryName),
            // A guess is a wrong brand's logo on the row, and an unrated domain
            // is a guess too; only a null here lets the grounded tier take over.
            domain: domainAccepted(output.domainConfidence) ? sanitizeDomain(output.domain) : null,
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
    currency?: string;
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
        currency: args.currency,
        income: args.income,
        key: knowledgeKey(args.name, args.currency),
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
        const currency = sanitizeCurrencyCode(args.currency);

        // Tier 1.5: an indexed read that costs nothing and consumes neither rate
        // limit bucket below — checked before `XAI_API_KEY` so a hit still works
        // even when that key is unset (design's degradation matrix).
        const cached = await ctx.runQuery(internal.merchantKnowledge.lookup, {
            key: knowledgeKey(trimmedName, currency),
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

        const perUser = await rateLimiter.limit(ctx, args.background ? "enrichmentBackground" : "enrichmentPerUser", {
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
                currency,
                income: args.income,
                locale: args.locale,
                name: trimmedName,
                regionCode,
            });

            // Scheduling is never awaited: it fills Tier 1.5 for the NEXT lookup
            // of this merchant, never this transaction.
            if (needsGroundedLookup(result)) {
                const scheduled =
                    args.groundedLookup &&
                    (await isPro(ctx, identity.subject)) &&
                    (await maybeScheduleGrounded(ctx, identity.tokenIdentifier, {
                        currency,
                        groundedLookup: args.groundedLookup,
                        income: args.income,
                        locale: args.locale,
                        name: trimmedName,
                        regionCode,
                    }));
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
