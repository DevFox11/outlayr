import { createXai } from "@ai-sdk/xai";
import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { generateText, type LanguageModel, Output } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "./_generated/api";
import { type ActionCtx, action, internalQuery } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { merchantKey } from "./lib/merchantKey";

/**
 * `grok-4-fast-non-reasoning` and `grok-3-mini` — the original design's pick
 * and fallback — do not exist in this account's model lineup (`GET
 * https://api.x.ai/v1/models`). Measured live against a real
 * merchant-extraction prompt: the `grok-4.20-0309` non-reasoning snapshot
 * settled in 841ms with correct structured output; `grok-4.5` took 2.69s.
 * `grok-4.5` is kept here only as the documented too-slow fallback — it is
 * never selected automatically. `XAI_MODEL_ID` overrides the primary id
 * without a deploy. Exported so `groundedLookup.ts` shares the same default
 * (ADR-12).
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

/**
 * The action's only arguments — a privacy boundary, not just a shape.
 * Amounts, dates, accounts, balances, and identity must never appear here;
 * only the merchant name and the user's own category names may leave the
 * device. Exported so `enrichment.test.ts` can assert the field count
 * directly rather than re-deriving it from the wrapped action.
 */
export const suggestArgs = {
	name: v.string(),
	income: v.boolean(),
	locale: v.optional(v.string()),
	/** The user's own categories, each with the names nested under it. */
	categoryTree: v.array(
		v.object({ name: v.string(), children: v.array(v.string()) }),
	),
	/**
	 * One side of ADR-6's dual-authority consent gate. A forged `true` alone
	 * cannot enable a grounded lookup — the synced `appMeta` row must also
	 * agree — but a `false` always blocks, from either side.
	 */
	groundedLookup: v.boolean(),
};

const suggestion = v.object({
	categoryName: v.union(v.string(), v.null()),
	isNewCategory: v.boolean(),
	/** Set only when the suggestion belongs under an existing category. */
	parentCategoryName: v.union(v.string(), v.null()),
	emoji: v.union(v.string(), v.null()),
	tags: v.array(v.string()),
	domain: v.union(v.string(), v.null()),
	/** Stable shared-cache object key; `logoUrl` mints a fresh signed url from it. */
	logoKey: v.union(v.string(), v.null()),
	logoUrl: v.union(v.string(), v.null()),
	/** A grounded lookup was scheduled — the client must not cache this as a final null result. */
	grounding: v.boolean(),
});

export interface CategoryBranch {
	name: string;
	children: string[];
}

export interface Suggestion {
	categoryName: string | null;
	isNewCategory: boolean;
	parentCategoryName: string | null;
	emoji: string | null;
	tags: string[];
	domain: string | null;
	logoKey: string | null;
	logoUrl: string | null;
	grounding: boolean;
}

export const EMPTY: Suggestion = {
	categoryName: null,
	isNewCategory: false,
	parentCategoryName: null,
	emoji: null,
	tags: [],
	domain: null,
	logoKey: null,
	logoUrl: null,
	grounding: false,
};

/** The model's own output is untrusted input — this is only the JSON shape. */
const modelOutputSchema = z.object({
	categoryName: z.string().nullable(),
	isNewCategory: z.boolean(),
	// Nullish rather than nullable: a model that simply omits one of these has
	// still answered the question that matters, and failing the whole call over
	// a missing optional field would cost the category and tags too.
	parentCategoryName: z.string().nullish(),
	emoji: z.string().nullish(),
	tags: z.array(z.string()),
	domain: z.string().nullable(),
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
	enrichmentPerUser: {
		kind: "token bucket",
		rate: 30,
		period: HOUR,
		capacity: 8,
	},
	// An unsharded global counter is one hot document and throws OCC write
	// conflicts under concurrency — `shards: 10` is load-bearing, not tuning.
	enrichmentGlobal: {
		kind: "fixed window",
		rate: 2000,
		period: HOUR,
		shards: 10,
	},
	// ADR-11: checked in `suggest` itself, before the internal action is ever
	// scheduled. Deliberately generous — a user in an uncovered country is
	// seeding the shared cache for everyone else; `groundedBudgetMicros` is
	// the real backstop.
	groundedPerUser: {
		kind: "token bucket",
		rate: 5,
		period: DAY,
		capacity: 5,
	},
	// ADR-10: kills both a user retyping the same unknown name and a
	// thundering herd across many users hitting one new merchant at once.
	// Checked inside `groundedLookup.run`, never here — see ADR-11's order.
	groundedPerKey: {
		kind: "token bucket",
		rate: 1,
		period: DAY,
		capacity: 1,
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
 * the logo fetcher (PR 6). Case-folded before the match so `NETFLIX.COM`
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
	return DOMAIN_PATTERN.test(trimmed) ? trimmed : null;
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

function describeTree(tree: readonly CategoryBranch[]): string {
	if (tree.length === 0) {
		return "none";
	}
	return tree
		.map((branch) =>
			branch.children.length > 0
				? `${branch.name} (containing ${branch.children.join(", ")})`
				: branch.name,
		)
		.join("; ");
}

function buildPrompt(
	name: string,
	income: boolean,
	locale: string | undefined,
	tree: readonly CategoryBranch[],
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
	]
		.filter((line) => line.length > 0)
		.join(" ");
}

export interface RunSuggestArgs {
	name: string;
	income: boolean;
	locale?: string;
	categoryTree: readonly CategoryBranch[];
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
	return /\p{Extended_Pictographic}/u.test(trimmed) ? trimmed : null;
}

export interface TreeCandidate {
	categoryName: string | null;
	parentCategoryName: string | null;
	emoji: string | null;
	tags: readonly string[];
	domain: string | null;
}

/**
 * Resolves a candidate's `isNewCategory`/`parentCategoryName` against one
 * user's own category tree. Shared by `runSuggest` (Tier 2, tree-relative
 * from the start) and `suggest`'s Tier 1.5 cache hit (a globally-shared
 * candidate applied to whichever user is asking this time) — the same
 * merchant can be "new" for one user and already-known for another.
 */
export function applyToTree(
	tree: readonly CategoryBranch[],
	candidate: TreeCandidate,
): Omit<Suggestion, "logoKey" | "logoUrl" | "grounding"> {
	const cappedTree = tree.slice(0, MAX_KNOWN_CATEGORY_NAMES);
	const everyName = cappedTree.flatMap((branch) => [
		branch.name,
		...branch.children,
	]);

	const { categoryName } = candidate;
	const isNewCategory =
		categoryName !== null && !everyName.includes(categoryName);
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
		isNewCategory,
		parentCategoryName,
		emoji: candidate.emoji,
		tags: [...candidate.tags],
		domain: candidate.domain,
	};
}

/**
 * Model call + sanitisation only — no auth, no env check, no rate limit.
 * Exported so tests can inject a fake model directly; the guard ladder above
 * it is exercised through the `suggest` action instead.
 */
export async function runSuggest(
	model: LanguageModel,
	args: RunSuggestArgs,
): Promise<Suggestion> {
	const tree = args.categoryTree.slice(0, MAX_KNOWN_CATEGORY_NAMES);

	const { output } = await generateText({
		model,
		output: Output.object({ schema: modelOutputSchema }),
		prompt: buildPrompt(args.name, args.income, args.locale, tree),
		abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		// The SDK default is 2 retries, which alone would triple worst-case
		// latency past the client's own 4s `Promise.race` abort.
		maxRetries: 0,
	});

	return {
		// The model's own `isNewCategory` claim is discarded by `applyToTree` —
		// it has no reason to be authoritative about the user's own local data.
		...applyToTree(args.categoryTree, {
			categoryName: sanitizeCategoryName(output.categoryName),
			parentCategoryName: sanitizeCategoryName(
				output.parentCategoryName ?? null,
			),
			emoji: sanitizeEmoji(output.emoji ?? null),
			tags: sanitizeTags(output.tags),
			domain: sanitizeDomain(output.domain),
		}),
		logoKey: null,
		logoUrl: null,
		grounding: false,
	};
}

const GROUNDED_LOOKUP_META_KEY = "groundedLookup";

/**
 * ADR-6's server-side half of the dual-authority gate: the synced `appMeta`
 * row, keyed the same way `sync.ts` writes it (`requireUserId`, NOT
 * `identity.tokenIdentifier` — those are different id spaces in this app).
 * An absent row defaults to consented, matching `SETTING_DEFAULTS.groundedLookup`
 * on the client (slice 4) — a device that has never synced this key has never
 * turned it off.
 */
export const groundedConsent = internalQuery({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db
			.query("appMeta")
			.withIndex("by_user_and_key", (q) =>
				q.eq("userId", userId).eq("key", GROUNDED_LOOKUP_META_KEY),
			)
			.unique();
		return row === null || row.value !== "false";
	},
});

export interface GroundedScheduleArgs {
	groundedLookup: boolean;
	name: string;
	income: boolean;
	locale?: string;
}

/**
 * The least ctx capability this needs — `Pick` rather than the full
 * `ActionCtx` so a `convex-test` `t.run` mutation-shaped ctx (which carries
 * the same `runQuery`/`runMutation`/`scheduler` signatures) can exercise this
 * function directly in tests, concretely typed, with no widening cast.
 */
export type GroundedScheduleCtx = Pick<
	ActionCtx,
	"runQuery" | "runMutation" | "scheduler"
>;

/**
 * ADR-11's order: `groundedPerUser` here, `groundedPerKey` and
 * `groundedBudgetMicros` inside `groundedLookup.run` itself. Returns whether a
 * lookup was actually scheduled, so `suggest` knows whether to report
 * `grounding: true`. `categoryTree` is deliberately not a parameter — ADR-7,
 * the scheduled args below can never carry it.
 */
export async function maybeScheduleGrounded(
	ctx: GroundedScheduleCtx,
	tokenIdentifier: string,
	args: GroundedScheduleArgs,
): Promise<boolean> {
	if (!args.groundedLookup) {
		console.log(
			"[grounded] NOT scheduled: client sent groundedLookup:false (Feature Lab toggle off)",
		);
		return false;
	}
	const consented = await ctx.runQuery(internal.enrichment.groundedConsent, {});
	if (!consented) {
		console.log(
			"[grounded] NOT scheduled: synced appMeta consent row says false",
		);
		return false;
	}
	const gate = await rateLimiter.limit(ctx, "groundedPerUser", {
		key: tokenIdentifier,
	});
	if (!gate.ok) {
		console.log(
			`[grounded] NOT scheduled: per-user gate (5/day); retry in ${gate.retryAfter}ms`,
		);
		return false;
	}
	console.log(`[grounded] scheduling lookup for "${args.name}"`);
	await ctx.scheduler.runAfter(0, internal.groundedLookup.run, {
		key: merchantKey(args.name),
		name: args.name,
		income: args.income,
		locale: args.locale,
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
	returns: suggestion,
	handler: async (ctx, args): Promise<Suggestion> => {
		console.log("[enrichment] in:", JSON.stringify(args));
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			console.log("[enrichment] BAIL 1/6: signed out — getUserIdentity() null");
			return EMPTY;
		}

		const trimmedName = args.name.trim();
		if (
			trimmedName.length < MIN_NAME_LENGTH ||
			trimmedName.length > MAX_NAME_LENGTH
		) {
			console.log(
				`[enrichment] BAIL 2/6: name length ${trimmedName.length} outside [${MIN_NAME_LENGTH}, ${MAX_NAME_LENGTH}]`,
			);
			return EMPTY;
		}

		// Tier 1.5: an indexed read that costs nothing and consumes neither rate
		// limit bucket below — checked before `XAI_API_KEY` so a hit still works
		// even when that key is unset (design's degradation matrix).
		const cached = await ctx.runQuery(internal.merchantKnowledge.lookup, {
			key: merchantKey(trimmedName),
		});
		if (cached !== null) {
			console.log("[enrichment] shared-cache HIT:", JSON.stringify(cached));
			return {
				...applyToTree(args.categoryTree, cached),
				logoKey: cached.logoKey,
				logoUrl: cached.logoUrl,
				grounding: false,
			};
		}
		console.log(
			`[enrichment] shared-cache miss for key "${merchantKey(trimmedName)}"`,
		);

		const apiKey = process.env.XAI_API_KEY;
		if (!apiKey) {
			console.log(
				"[enrichment] BAIL 3/6: XAI_API_KEY unset on this deployment — run `npx convex env set XAI_API_KEY ...`",
			);
			return EMPTY;
		}

		const perUser = await rateLimiter.limit(ctx, "enrichmentPerUser", {
			key: identity.tokenIdentifier,
		});
		if (!perUser.ok) {
			console.log(
				`[enrichment] BAIL 4/6: per-user rate limit (30/h, burst 8); retry in ${perUser.retryAfter}ms`,
			);
			return EMPTY;
		}

		const global = await rateLimiter.limit(ctx, "enrichmentGlobal");
		if (!global.ok) {
			console.log(
				`[enrichment] BAIL 5/6: global rate limit (2000/h); retry in ${global.retryAfter}ms`,
			);
			return EMPTY;
		}
		console.log(`[enrichment] calling xAI for "${trimmedName}"`);

		try {
			const xaiProvider = createXai({ apiKey });
			const modelId = process.env.XAI_MODEL_ID || ENRICHMENT_MODEL_ID;
			const result = await runSuggest(xaiProvider(modelId), {
				name: trimmedName,
				income: args.income,
				locale: args.locale,
				categoryTree: args.categoryTree,
			});

			console.log(
				`[enrichment] xAI out for "${trimmedName}":`,
				JSON.stringify(result),
			);
			// On a genuine Tier-2 miss only: scheduling (never awaited) fills Tier
			// 1.5 for the NEXT lookup of this merchant, never this transaction. When
			// consent/rate-limit refuses, `result` — Tier 2's own sanitised output,
			// unchanged from today — is returned instead of a manufactured miss.
			if (result.categoryName === null) {
				const scheduled = await maybeScheduleGrounded(
					ctx,
					identity.tokenIdentifier,
					{
						groundedLookup: args.groundedLookup,
						name: trimmedName,
						income: args.income,
						locale: args.locale,
					},
				);
				console.log(
					`[enrichment] tier-2 miss; grounded lookup scheduled = ${scheduled}`,
				);
				if (scheduled) {
					return { ...EMPTY, grounding: true };
				}
			}
			console.log("[enrichment] out:", JSON.stringify(result));
			return result;
		} catch (error) {
			console.warn(
				`[enrichment] BAIL 6/6: xAI call threw for "${trimmedName}" (model ${process.env.XAI_MODEL_ID || ENRICHMENT_MODEL_ID}):`,
				error instanceof Error
					? `${error.name}: ${error.message}`
					: String(error),
			);
			// A rejected xAI call surfaces here as a normal degradation, not a
			// thrown ConvexError — throwing would fill function logs with stack
			// traces for an entirely ordinary timeout or provider outage.
			return EMPTY;
		}
	},
});
