import { createXai } from "@ai-sdk/xai";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { generateText, type LanguageModel, Output } from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * `grok-4-fast-non-reasoning` and `grok-3-mini` — the original design's pick
 * and fallback — do not exist in this account's model lineup (`GET
 * https://api.x.ai/v1/models`). Measured live against a real
 * merchant-extraction prompt: `grok-4.20-0309-non-reasoning` settled in
 * 841ms with correct structured output; `grok-4.5` took 2.69s. `grok-4.5` is
 * kept here only as the documented too-slow fallback — it is never selected
 * automatically. `XAI_MODEL_ID` overrides the primary id without a deploy.
 */
const ENRICHMENT_MODEL_ID = "grok-4.20-0309-non-reasoning";
export const ENRICHMENT_FALLBACK_MODEL_ID = "grok-4.5";

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 64;
const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 24;
const MAX_CATEGORY_NAME_LENGTH = 40;
const MAX_DOMAIN_LENGTH = 253;
const MAX_KNOWN_CATEGORY_NAMES = 60;
/** The action's own budget under the client's 4s `Promise.race` abort. */
const REQUEST_TIMEOUT_MS = 3500;
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
};

const suggestion = v.object({
	categoryName: v.union(v.string(), v.null()),
	isNewCategory: v.boolean(),
	/** Set only when the suggestion belongs under an existing category. */
	parentCategoryName: v.union(v.string(), v.null()),
	emoji: v.union(v.string(), v.null()),
	tags: v.array(v.string()),
	domain: v.union(v.string(), v.null()),
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
}

export const EMPTY: Suggestion = {
	categoryName: null,
	isNewCategory: false,
	parentCategoryName: null,
	emoji: null,
	tags: [],
	domain: null,
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
});

function sanitizeTags(tags: readonly string[]): string[] {
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
function sanitizeDomain(domain: string | null): string | null {
	if (domain === null) {
		return null;
	}
	const trimmed = domain.trim().toLowerCase();
	if (trimmed.length === 0 || trimmed.length > MAX_DOMAIN_LENGTH) {
		return null;
	}
	return DOMAIN_PATTERN.test(trimmed) ? trimmed : null;
}

function sanitizeCategoryName(name: string | null): string | null {
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
function sanitizeEmoji(emoji: string | null): string | null {
	if (emoji === null) {
		return null;
	}
	const trimmed = emoji.trim();
	if (trimmed.length === 0 || [...trimmed].length > 3) {
		return null;
	}
	return /\p{Extended_Pictographic}/u.test(trimmed) ? trimmed : null;
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
	const everyName = tree.flatMap((branch) => [branch.name, ...branch.children]);

	const { output } = await generateText({
		model,
		output: Output.object({ schema: modelOutputSchema }),
		prompt: buildPrompt(args.name, args.income, args.locale, tree),
		abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		// The SDK default is 2 retries, which alone would triple worst-case
		// latency past the client's own 4s `Promise.race` abort.
		maxRetries: 0,
	});

	const categoryName = sanitizeCategoryName(output.categoryName);
	const isNewCategory =
		categoryName !== null && !everyName.includes(categoryName);
	// A parent is only ever one of the top-level names actually sent, and only
	// for a category being created. Anything else the model names is dropped
	// rather than trusted — it cannot know this ledger's shape.
	const proposedParent = sanitizeCategoryName(
		output.parentCategoryName ?? null,
	);
	const parentCategoryName =
		isNewCategory &&
		proposedParent !== null &&
		proposedParent !== categoryName &&
		tree.some((branch) => branch.name === proposedParent)
			? proposedParent
			: null;

	return {
		categoryName,
		// The model's own `isNewCategory` claim is discarded — it has no reason
		// to be authoritative about the user's own local data.
		isNewCategory,
		parentCategoryName,
		emoji: sanitizeEmoji(output.emoji ?? null),
		tags: sanitizeTags(output.tags),
		domain: sanitizeDomain(output.domain),
	};
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
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			return EMPTY;
		}

		const apiKey = process.env.XAI_API_KEY;
		if (!apiKey) {
			return EMPTY;
		}

		const trimmedName = args.name.trim();
		if (
			trimmedName.length < MIN_NAME_LENGTH ||
			trimmedName.length > MAX_NAME_LENGTH
		) {
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
			return await runSuggest(xaiProvider(modelId), {
				name: trimmedName,
				income: args.income,
				locale: args.locale,
				categoryTree: args.categoryTree,
			});
		} catch {
			// A rejected xAI call surfaces here as a normal degradation, not a
			// thrown ConvexError — throwing would fill function logs with stack
			// traces for an entirely ordinary timeout or provider outage.
			return EMPTY;
		}
	},
});
