import { useCallback, useRef, useState } from "react";
import { categoryKey, type ParsedImportFile } from "@/data/transfer-core";
import { setCachedEnrichment } from "@/domain/enrichment-cache";
import {
	buildClassificationPayload,
	scrubLabel,
} from "@/domain/import-ai-payload";
import type {
	ResolutionOutcome,
	UnavailableReason,
} from "@/domain/import-flow";
import type { MappingDraft } from "@/domain/import-mapping";
import { cachedLabelEnrichment } from "@/domain/import-review-identity";
import { merchantKey, resolveMerchant } from "@/domain/merchant-resolver";
import {
	type CategoryBranch,
	type CsvImportFn,
	type CsvImportResult,
	type CsvImportStatus,
	csvImportTransport,
} from "@/lib/convex";

export const AI_TIER_MAX_CHARS = 2_000_000;
export const AI_TIER_MAX_ROWS = 5_000;
export const CLIENT_TIMEOUT_MS = 15_000;

export interface UseCsvImportArgs {
	parsed: ParsedImportFile;
	draft: MappingDraft;
	labels: readonly string[];
	chars: number;
	categoryTree: readonly CategoryBranch[];
	categoryIdByKey: ReadonlyMap<string, string>;
	aiEnrichment: boolean;
	/** The synced grounded-lookup consent; the server re-checks it too. */
	groundedLookup: boolean;
	regionCode: string | undefined;
	transport?: CsvImportFn | null;
	/**
	 * Identifies the selected file. Must be a primitive value — `parsed` itself
	 * gets rebuilt into a fresh object on every render in some call sites, so it
	 * cannot be used to detect a genuine file change.
	 */
	fileKey: string | null;
}

export interface UseCsvImportResult {
	running: boolean;
	outcome: ResolutionOutcome | null;
	reason: UnavailableReason | null;
	links: ReadonlyMap<string, string>;
	fromModel: ReadonlySet<string>;
	totalLabels: number;
	tier1Matched: number;
	tier2Sent: number;
	run: () => void;
}

const REASON_BY_STATUS: Record<
	Exclude<CsvImportStatus, "ok">,
	UnavailableReason
> = {
	notConfigured: "notConfigured",
	rateLimited: "rateLimited",
	invalidResponse: "invalidResponse",
	providerError: "providerError",
	invalid: "providerError",
	unauthenticated: "unauthenticated",
};

type Settled =
	| { kind: "result"; result: CsvImportResult }
	| { kind: "timeout" }
	| { kind: "rejected" };

function settleWith(
	links: ReadonlyMap<string, string>,
	fromModel: ReadonlySet<string>,
	outcome: ResolutionOutcome,
	reason: UnavailableReason | null,
) {
	return { links, fromModel, outcome, reason };
}

type Settlement = ReturnType<typeof settleWith>;

interface PartialResolution {
	links: ReadonlyMap<string, string>;
	fromModel: ReadonlySet<string>;
}

const TIMED_OUT = Symbol("csv-import-timeout");

export function useCsvImport(args: UseCsvImportArgs): UseCsvImportResult {
	const [running, setRunning] = useState(false);
	const [outcome, setOutcome] = useState<ResolutionOutcome | null>(null);
	const [reason, setReason] = useState<UnavailableReason | null>(null);
	const [links, setLinks] = useState<ReadonlyMap<string, string>>(new Map());
	const [fromModel, setFromModel] = useState<ReadonlySet<string>>(new Set());
	const [tier1Matched, setTier1Matched] = useState(0);
	const [tier2Sent, setTier2Sent] = useState(0);
	const [trackedFileKey, setTrackedFileKey] = useState(args.fileKey);

	const runningRef = useRef(false);
	// Bumped on every file change so a stale in-flight execute() for the
	// previous file can't clobber state after the user picked a new one.
	const generationRef = useRef(0);
	const partialRef = useRef<PartialResolution | null>(null);

	if (trackedFileKey !== args.fileKey) {
		setTrackedFileKey(args.fileKey);
		generationRef.current += 1;
		runningRef.current = false;
		setRunning(false);
		setOutcome(null);
		setReason(null);
		setLinks(new Map());
		setFromModel(new Set());
		setTier1Matched(0);
		setTier2Sent(0);
	}

	const parsedRef = useRef(args.parsed);
	parsedRef.current = args.parsed;
	const draftRef = useRef(args.draft);
	draftRef.current = args.draft;
	const labelsRef = useRef(args.labels);
	labelsRef.current = args.labels;
	const charsRef = useRef(args.chars);
	charsRef.current = args.chars;
	const categoryTreeRef = useRef(args.categoryTree);
	categoryTreeRef.current = args.categoryTree;
	const categoryIdByKeyRef = useRef(args.categoryIdByKey);
	categoryIdByKeyRef.current = args.categoryIdByKey;
	const aiEnrichmentRef = useRef(args.aiEnrichment);
	aiEnrichmentRef.current = args.aiEnrichment;
	const groundedLookupRef = useRef(args.groundedLookup);
	groundedLookupRef.current = args.groundedLookup;
	const regionCodeRef = useRef(args.regionCode);
	regionCodeRef.current = args.regionCode;
	const transportRef = useRef(args.transport);
	transportRef.current = args.transport;

	const resolveImport = useCallback(async (): Promise<Settlement> => {
		const allLabels = labelsRef.current;
		const resolvedLinks = new Map<string, string>();
		const fromModelSet = new Set<string>();
		partialRef.current = { links: resolvedLinks, fromModel: fromModelSet };
		const unresolved: string[] = [];

		// A map match without a domain keeps its tier-1 category link but still
		// travels to the server, so `merchantKnowledge` can supply — or a grounded
		// lookup can learn — the domain the curated map does not carry.
		const domainless: string[] = [];
		for (const label of allLabels) {
			const match = resolveMerchant(label);
			const categoryId =
				match == null
					? undefined
					: categoryIdByKeyRef.current.get(categoryKey(match.categoryName));
			if (categoryId != null) {
				resolvedLinks.set(categoryKey(label), categoryId);
				if (match?.domain == null) {
					domainless.push(label);
				}
			} else {
				unresolved.push(label);
			}
		}
		setTier1Matched(allLabels.length - unresolved.length);

		const stillUnresolved: string[] = [];
		for (const label of unresolved) {
			const cached = cachedLabelEnrichment(label);
			const categoryName = cached.hit
				? (cached.value?.categoryName ?? null)
				: null;
			const categoryId =
				categoryName == null
					? undefined
					: categoryIdByKeyRef.current.get(categoryKey(categoryName));
			if (cached.hit && categoryId != null) {
				resolvedLinks.set(categoryKey(label), categoryId);
				fromModelSet.add(categoryKey(label));
			} else {
				stillUnresolved.push(label);
			}
		}

		const rawByScrubbed = new Map<string, string[]>();
		for (const label of stillUnresolved) {
			const scrubbed = scrubLabel(label);
			const existing = rawByScrubbed.get(scrubbed);
			if (existing == null) {
				rawByScrubbed.set(scrubbed, [label]);
			} else {
				existing.push(label);
			}
		}

		const domainUnknown = domainless.filter((label) => {
			const cached = cachedLabelEnrichment(label);
			return !(cached.hit && cached.value?.domain != null);
		});

		const payload = buildClassificationPayload({
			parsed: parsedRef.current,
			draft: draftRef.current,
			unresolvedLabels: [...stillUnresolved, ...domainUnknown],
			categoryTree: categoryTreeRef.current,
		});

		if (payload == null) {
			return settleWith(resolvedLinks, fromModelSet, "applied", null);
		}

		if (!aiEnrichmentRef.current) {
			return settleWith(resolvedLinks, fromModelSet, "declined", null);
		}

		if (
			charsRef.current > AI_TIER_MAX_CHARS ||
			parsedRef.current.rows.length > AI_TIER_MAX_ROWS
		) {
			return settleWith(resolvedLinks, fromModelSet, "unavailable", "overCap");
		}

		const call =
			transportRef.current === undefined
				? csvImportTransport()
				: transportRef.current;
		if (call == null) {
			return settleWith(
				resolvedLinks,
				fromModelSet,
				"unavailable",
				"notConfigured",
			);
		}

		setTier2Sent(payload.labels.length);
		let settled: Settled;
		try {
			const raced = await Promise.race([
				call({
					...payload,
					groundedLookup: groundedLookupRef.current,
					regionCode: regionCodeRef.current,
				}),
				new Promise<typeof TIMED_OUT>((resolve) => {
					setTimeout(() => resolve(TIMED_OUT), CLIENT_TIMEOUT_MS);
				}),
			]);
			settled =
				raced === TIMED_OUT
					? { kind: "timeout" }
					: { kind: "result", result: raced };
		} catch {
			settled = { kind: "rejected" };
		}

		if (settled.kind !== "result") {
			return settleWith(
				resolvedLinks,
				fromModelSet,
				"unavailable",
				settled.kind === "timeout" ? "timeout" : "offline",
			);
		}

		if (settled.result.status !== "ok") {
			return settleWith(
				resolvedLinks,
				fromModelSet,
				"unavailable",
				REASON_BY_STATUS[settled.result.status],
			);
		}

		for (const suggestion of settled.result.suggestions ?? []) {
			if (suggestion.domain != null) {
				setCachedEnrichment(merchantKey(suggestion.label), {
					categoryName: suggestion.categoryName,
					isNewCategory: false,
					tags: [],
					domain: suggestion.domain,
				});
			}
			const categoryId = categoryIdByKeyRef.current.get(
				categoryKey(suggestion.categoryName),
			);
			if (categoryId == null) {
				continue;
			}
			for (const raw of rawByScrubbed.get(suggestion.label) ?? []) {
				resolvedLinks.set(categoryKey(raw), categoryId);
				fromModelSet.add(categoryKey(raw));
			}
		}

		return settleWith(resolvedLinks, fromModelSet, "applied", null);
	}, []);

	const execute = useCallback(async () => {
		const generation = generationRef.current;
		setRunning(true);
		setOutcome(null);
		setReason(null);
		setTier2Sent(0);
		partialRef.current = null;

		let settlement: Settlement;
		try {
			settlement = await resolveImport();
		} catch {
			// TS narrows `partialRef.current` to `null` here because it can't see
			// `resolveImport` reassigning it before throwing — assert the real type.
			const partial = partialRef.current as PartialResolution | null;
			settlement = settleWith(
				partial?.links ?? new Map(),
				partial?.fromModel ?? new Set(),
				"unavailable",
				"providerError",
			);
		}

		if (generationRef.current === generation) {
			setLinks(settlement.links);
			setFromModel(settlement.fromModel);
			setOutcome(settlement.outcome);
			setReason(settlement.reason);
			setRunning(false);
		}
	}, [resolveImport]);

	const run = useCallback(() => {
		if (runningRef.current) {
			return;
		}
		const generation = generationRef.current;
		runningRef.current = true;
		void execute().finally(() => {
			if (generationRef.current === generation) {
				runningRef.current = false;
			}
		});
	}, [execute]);

	return {
		running,
		outcome,
		reason,
		links,
		fromModel,
		totalLabels: args.labels.length,
		tier1Matched,
		tier2Sent,
		run,
	};
}
