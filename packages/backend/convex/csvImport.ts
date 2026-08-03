import { createXai } from "@ai-sdk/xai";
import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import {
	generateText,
	type LanguageModel,
	NoObjectGeneratedError,
	Output,
	TypeValidationError,
} from "ai";
import { v } from "convex/values";
import { z } from "zod";

import { components } from "./_generated/api";
import { action } from "./_generated/server";

/** `XAI_MODEL_ID` overrides this without a deploy, matching `enrichment.ts`. */
const CSV_IMPORT_MODEL_ID = "grok-4.20-0309-non-reasoning";

const MAX_LABELS = 200;
/** The action's own budget under the client's 15s hard `Promise.race` abort. */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * The action's only arguments — a privacy boundary asserted by test, not just
 * a shape. This is exactly `import-ai-payload.ts`'s `ClassificationPayload`:
 * no raw file, no full row set, no amount or date value, and no per-row data
 * of any kind may reach here.
 */
export const csvImportArgs = {
	labels: v.array(v.string()),
	categoryTree: v.array(
		v.object({ name: v.string(), children: v.array(v.string()) }),
	),
};

const labelSuggestion = v.object({
	label: v.string(),
	categoryName: v.string(),
});

const csvImportStatus = v.union(
	v.literal("ok"),
	v.literal("unauthenticated"),
	v.literal("notConfigured"),
	v.literal("rateLimited"),
	v.literal("invalid"),
	v.literal("providerError"),
	v.literal("invalidResponse"),
);

const csvImportResult = v.object({
	status: csvImportStatus,
	suggestions: v.union(v.array(labelSuggestion), v.null()),
});

export interface CategoryBranch {
	name: string;
	children: string[];
}

export interface LabelSuggestion {
	label: string;
	categoryName: string;
}

export type CsvImportStatus =
	| "ok"
	| "unauthenticated"
	| "notConfigured"
	| "rateLimited"
	| "invalid"
	| "providerError"
	| "invalidResponse";

export interface CsvImportResult {
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
			label: z.string(),
			categoryName: z.string().nullable(),
		}),
	),
});

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

export interface RunClassifyArgs {
	labels: readonly string[];
	categoryTree: readonly CategoryBranch[];
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
 * Keyed by `identity.tokenIdentifier`, per the repo's Convex guidelines
 * (preferred over `subject`), never a client argument. An import is far
 * heavier than one merchant name, so both buckets are smaller than
 * `enrichment.ts`'s. `shards: 10` is copied from `enrichment.ts:118` and is
 * load-bearing — an unsharded global counter is one hot document and throws
 * OCC write conflicts under concurrency.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	csvImportPerUser: {
		kind: "token bucket",
		rate: 6,
		period: HOUR,
		capacity: 2,
	},
	csvImportGlobal: {
		kind: "fixed window",
		rate: 200,
		period: HOUR,
		shards: 10,
	},
});

/**
 * Model call, sanitisation, and failure classification only — no auth, no env
 * check, no rate limit. Exported so tests can inject a fake `LanguageModel`
 * directly, since the real xAI provider cannot be substituted through the
 * wrapped `csvImport` action.
 */
export async function classify(
	model: LanguageModel,
	args: RunClassifyArgs,
): Promise<CsvImportResult> {
	try {
		const { output } = await generateText({
			model,
			output: Output.object({ schema: modelOutputSchema }),
			prompt: buildPrompt(args),
			abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			// The SDK default is 2 retries, which alone would blow past the
			// client's own 15s `Promise.race` abort.
			maxRetries: 0,
		});

		const known = new Set(
			args.categoryTree.flatMap((branch) => [branch.name, ...branch.children]),
		);

		const suggestions: LabelSuggestion[] = [];
		for (const item of output.mapping) {
			const categoryName = item.categoryName?.trim();
			// The model cannot know this ledger's shape: a name it invents is
			// dropped rather than trusted, and dropping it is not a schema
			// failure — the rest of a well-formed response still applies.
			if (!categoryName || !known.has(categoryName)) {
				continue;
			}
			suggestions.push({ label: item.label, categoryName });
		}

		return { status: "ok", suggestions };
	} catch (error) {
		if (
			NoObjectGeneratedError.isInstance(error) ||
			TypeValidationError.isInstance(error)
		) {
			// The model's JSON failed schema validation: the whole response is
			// untrustworthy, so zero suggestions are applied rather than
			// sanitising per field.
			return failure("invalidResponse");
		}
		return failure("providerError");
	}
}

/**
 * Read live rather than through a frozen snapshot, so that
 * `npx convex env set XAI_API_KEY=""` takes effect on the very next call.
 */
export const csvImport = action({
	args: csvImportArgs,
	returns: csvImportResult,
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

		const perUser = await rateLimiter.limit(ctx, "csvImportPerUser", {
			key: identity.tokenIdentifier,
		});
		if (!perUser.ok) {
			return failure("rateLimited");
		}

		const global = await rateLimiter.limit(ctx, "csvImportGlobal");
		if (!global.ok) {
			return failure("rateLimited");
		}

		const xaiProvider = createXai({ apiKey });
		const modelId = process.env.XAI_MODEL_ID || CSV_IMPORT_MODEL_ID;
		return await classify(xaiProvider(modelId), {
			labels: args.labels,
			categoryTree: args.categoryTree,
		});
	},
});
