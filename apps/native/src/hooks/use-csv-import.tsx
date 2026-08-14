import { useCallback, useReducer, useRef } from "react";

import { categoryKey } from "@/data/transfer-core";
import type { ParsedImportFile } from "@/data/transfer-core";
import { setCachedEnrichment } from "@/domain/enrichment-cache";
import { buildClassificationPayload, scrubLabel } from "@/domain/import-ai-payload";
import type { ResolutionOutcome, UnavailableReason } from "@/domain/import-flow";
import type { MappingDraft } from "@/domain/import-mapping";
import { cachedLabelEnrichment } from "@/domain/import-review-identity";
import { merchantKey, resolveMerchant } from "@/domain/merchant-resolver";
import { csvImportTransport } from "@/lib/convex";
import type {
    CategoryBranch,
    CsvImportFn,
    CsvImportRequest,
    CsvImportResult,
    CsvImportStatus,
    LabelSuggestion,
} from "@/lib/convex";

export const AI_TIER_MAX_CHARS = 2_000_000;
export const AI_TIER_MAX_ROWS = 5000;
export const CLIENT_TIMEOUT_MS = 15_000;

export interface UseCsvImportArgs {
    aiEnrichment: boolean;
    categoryIdByKey: ReadonlyMap<string, string>;
    categoryTree: readonly CategoryBranch[];
    chars: number;
    draft: MappingDraft;
    /**
     * Identifies the selected file. Must be a primitive value — `parsed` itself
     * gets rebuilt into a fresh object on every render in some call sites, so it
     * cannot be used to detect a genuine file change.
     */
    fileKey: string | null;
    /** The synced grounded-lookup consent; the server re-checks it too. */
    groundedLookup: boolean;
    labels: readonly string[];
    parsed: ParsedImportFile;
    regionCode: string | undefined;
    transport?: CsvImportFn | null;
}

export type CsvImportStage = "idle" | "matching" | "asking" | "settled";

export interface UseCsvImportResult {
    fromModel: ReadonlySet<string>;
    links: ReadonlyMap<string, string>;
    outcome: ResolutionOutcome | null;
    reason: UnavailableReason | null;
    run: () => void;
    running: boolean;
    stage: CsvImportStage;
    tier1Matched: number;
    tier2Sent: number;
    totalLabels: number;
}

const REASON_BY_STATUS = {
    invalid: "providerError",
    invalidResponse: "invalidResponse",
    notConfigured: "notConfigured",
    providerError: "providerError",
    rateLimited: "rateLimited",
    unauthenticated: "unauthenticated",
} satisfies Record<Exclude<CsvImportStatus, "ok">, UnavailableReason>;

type Settled = { kind: "result"; result: CsvImportResult } | { kind: "timeout" } | { kind: "rejected" };

function settleWith(
    links: ReadonlyMap<string, string>,
    fromModel: ReadonlySet<string>,
    outcome: ResolutionOutcome,
    reason: UnavailableReason | null
) {
    return { fromModel, links, outcome, reason };
}

type Settlement = ReturnType<typeof settleWith>;

interface PartialResolution {
    fromModel: ReadonlySet<string>;
    links: ReadonlyMap<string, string>;
}

const TIMED_OUT = Symbol("csv-import-timeout");

const NO_LINKS: ReadonlyMap<string, string> = new Map();
const NO_FROM_MODEL: ReadonlySet<string> = new Set();

interface CsvImportState {
    fileKey: string | null;
    fromModel: ReadonlySet<string>;
    links: ReadonlyMap<string, string>;
    outcome: ResolutionOutcome | null;
    reason: UnavailableReason | null;
    stage: CsvImportStage;
    tier1Matched: number;
    tier2Sent: number;
}

type CsvImportAction =
    | { type: "fileChanged"; fileKey: string | null }
    | { type: "started" }
    | { type: "matched"; tier1Matched: number }
    | { type: "asking"; tier2Sent: number }
    | { type: "settled"; settlement: Settlement };

function idleState(fileKey: string | null): CsvImportState {
    return {
        fileKey,
        fromModel: NO_FROM_MODEL,
        links: NO_LINKS,
        outcome: null,
        reason: null,
        stage: "idle",
        tier1Matched: 0,
        tier2Sent: 0,
    };
}

function reduce(state: CsvImportState, action: CsvImportAction): CsvImportState {
    switch (action.type) {
        case "fileChanged": {
            return idleState(action.fileKey);
        }
        case "started": {
            return {
                ...state,
                outcome: null,
                reason: null,
                stage: "matching",
                tier2Sent: 0,
            };
        }
        case "matched": {
            return { ...state, tier1Matched: action.tier1Matched };
        }
        case "asking": {
            return { ...state, stage: "asking", tier2Sent: action.tier2Sent };
        }
        case "settled": {
            return { ...state, stage: "settled", ...action.settlement };
        }
        default: {
            const unhandled: never = action;
            throw new Error(`Unhandled csv import action: ${JSON.stringify(unhandled)}`);
        }
    }
}

/** Labels the curated map could not finish with: no domain, or no match at all. */
interface MerchantLinkGaps {
    domainless: string[];
    unresolved: string[];
}

function linkKnownMerchants(
    labels: readonly string[],
    categoryIdByKey: ReadonlyMap<string, string>,
    links: Map<string, string>
): MerchantLinkGaps {
    const unresolved: string[] = [];

    // A map match without a domain keeps its tier-1 category link but still
    // travels to the server, so `merchantKnowledge` can supply — or a grounded
    // lookup can learn — the domain the curated map does not carry.
    const domainless: string[] = [];
    for (const label of labels) {
        const match = resolveMerchant(label);
        const categoryId = match == null ? undefined : categoryIdByKey.get(categoryKey(match.categoryName));
        if (categoryId == null) {
            unresolved.push(label);
        } else {
            links.set(categoryKey(label), categoryId);
            if (match?.domain == null) {
                domainless.push(label);
            }
        }
    }
    return { domainless, unresolved };
}

function linkCachedLabels(
    labels: readonly string[],
    categoryIdByKey: ReadonlyMap<string, string>,
    links: Map<string, string>,
    fromModel: Set<string>
): string[] {
    const stillUnresolved: string[] = [];
    for (const label of labels) {
        const cached = cachedLabelEnrichment(label);
        const categoryName = cached.hit ? (cached.value?.categoryName ?? null) : null;
        const categoryId = categoryName == null ? undefined : categoryIdByKey.get(categoryKey(categoryName));
        if (cached.hit && categoryId != null) {
            links.set(categoryKey(label), categoryId);
            fromModel.add(categoryKey(label));
        } else {
            stillUnresolved.push(label);
        }
    }
    return stillUnresolved;
}

function groupByScrubbedLabel(labels: readonly string[]): ReadonlyMap<string, string[]> {
    const rawByScrubbed = new Map<string, string[]>();
    for (const label of labels) {
        const scrubbed = scrubLabel(label);
        const existing = rawByScrubbed.get(scrubbed);
        if (existing == null) {
            rawByScrubbed.set(scrubbed, [label]);
        } else {
            existing.push(label);
        }
    }
    return rawByScrubbed;
}

async function askModel(call: CsvImportFn, request: CsvImportRequest): Promise<Settled> {
    try {
        const raced = await Promise.race([
            call(request),
            new Promise<typeof TIMED_OUT>((resolve) => {
                setTimeout(() => resolve(TIMED_OUT), CLIENT_TIMEOUT_MS);
            }),
        ]);
        return raced === TIMED_OUT ? { kind: "timeout" } : { kind: "result", result: raced };
    } catch {
        return { kind: "rejected" };
    }
}

function linkSuggestions(
    suggestions: readonly LabelSuggestion[],
    categoryIdByKey: ReadonlyMap<string, string>,
    rawByScrubbed: ReadonlyMap<string, string[]>,
    links: Map<string, string>,
    fromModel: Set<string>
): void {
    for (const suggestion of suggestions) {
        if (suggestion.domain != null) {
            setCachedEnrichment(merchantKey(suggestion.label), {
                categoryName: suggestion.categoryName,
                domain: suggestion.domain,
                isNewCategory: false,
                tags: [],
            });
        }
        const categoryId = categoryIdByKey.get(categoryKey(suggestion.categoryName));
        if (categoryId == null) {
            continue;
        }
        for (const raw of rawByScrubbed.get(suggestion.label) ?? []) {
            links.set(categoryKey(raw), categoryId);
            fromModel.add(categoryKey(raw));
        }
    }
}

export function useCsvImport(args: UseCsvImportArgs): UseCsvImportResult {
    const [state, dispatch] = useReducer(reduce, args.fileKey, idleState);

    const runningRef = useRef(false);
    // Bumped on every file change so a stale in-flight execute() for the
    // previous file can't clobber state after the user picked a new one.
    const generationRef = useRef(0);
    const partialRef = useRef<PartialResolution | null>(null);

    if (state.fileKey !== args.fileKey) {
        generationRef.current += 1;
        runningRef.current = false;
        dispatch({ fileKey: args.fileKey, type: "fileChanged" });
    }

    const argsRef = useRef(args);
    argsRef.current = args;

    const resolveImport = useCallback(async (): Promise<Settlement> => {
        const allLabels = argsRef.current.labels;
        const resolvedLinks = new Map<string, string>();
        const fromModelSet = new Set<string>();
        partialRef.current = { fromModel: fromModelSet, links: resolvedLinks };

        const { domainless, unresolved } = linkKnownMerchants(
            allLabels,
            argsRef.current.categoryIdByKey,
            resolvedLinks
        );
        dispatch({
            tier1Matched: allLabels.length - unresolved.length,
            type: "matched",
        });

        const stillUnresolved = linkCachedLabels(
            unresolved,
            argsRef.current.categoryIdByKey,
            resolvedLinks,
            fromModelSet
        );
        const rawByScrubbed = groupByScrubbedLabel(stillUnresolved);

        const domainUnknown = domainless.filter((label) => {
            const cached = cachedLabelEnrichment(label);
            return !(cached.hit && cached.value?.domain != null);
        });

        const payload = buildClassificationPayload({
            categoryTree: argsRef.current.categoryTree,
            draft: argsRef.current.draft,
            parsed: argsRef.current.parsed,
            unresolvedLabels: [...stillUnresolved, ...domainUnknown],
        });

        if (payload == null) {
            return settleWith(resolvedLinks, fromModelSet, "applied", null);
        }

        if (!argsRef.current.aiEnrichment) {
            return settleWith(resolvedLinks, fromModelSet, "declined", null);
        }

        if (argsRef.current.chars > AI_TIER_MAX_CHARS || argsRef.current.parsed.rows.length > AI_TIER_MAX_ROWS) {
            return settleWith(resolvedLinks, fromModelSet, "unavailable", "overCap");
        }

        const call = argsRef.current.transport === undefined ? csvImportTransport() : argsRef.current.transport;
        if (call == null) {
            return settleWith(resolvedLinks, fromModelSet, "unavailable", "notConfigured");
        }

        dispatch({ tier2Sent: payload.labels.length, type: "asking" });
        const settled = await askModel(call, {
            ...payload,
            groundedLookup: argsRef.current.groundedLookup,
            regionCode: argsRef.current.regionCode,
        });

        if (settled.kind !== "result") {
            return settleWith(
                resolvedLinks,
                fromModelSet,
                "unavailable",
                settled.kind === "timeout" ? "timeout" : "offline"
            );
        }

        if (settled.result.status !== "ok") {
            return settleWith(resolvedLinks, fromModelSet, "unavailable", REASON_BY_STATUS[settled.result.status]);
        }

        linkSuggestions(
            settled.result.suggestions ?? [],
            argsRef.current.categoryIdByKey,
            rawByScrubbed,
            resolvedLinks,
            fromModelSet
        );

        return settleWith(resolvedLinks, fromModelSet, "applied", null);
    }, []);

    const execute = useCallback(async () => {
        const generation = generationRef.current;
        dispatch({ type: "started" });
        partialRef.current = null;

        let settlement: Settlement;
        try {
            settlement = await resolveImport();
        } catch {
            // TS narrows `partialRef.current` to `null` here because it can't see
            // `resolveImport` reassigning it before throwing — assert the real type.
            // SAFETY: stated in the comment above — `resolveImport` assigns it before
            // throwing, which TS cannot see across the boundary.
            const partial = partialRef.current as PartialResolution | null;
            settlement = settleWith(
                partial?.links ?? NO_LINKS,
                partial?.fromModel ?? NO_FROM_MODEL,
                "unavailable",
                "providerError"
            );
        }

        if (generationRef.current === generation) {
            dispatch({ settlement, type: "settled" });
        }
    }, [resolveImport]);

    const run = useCallback(() => {
        if (runningRef.current) {
            return;
        }
        const generation = generationRef.current;
        runningRef.current = true;
        // oxlint-disable-next-line no-void -- execute() settles its own failure into the reducer, and `run` is a synchronous press handler with nothing to await
        void execute().finally(() => {
            if (generationRef.current === generation) {
                runningRef.current = false;
            }
        });
    }, [execute]);

    return {
        fromModel: state.fromModel,
        links: state.links,
        outcome: state.outcome,
        reason: state.reason,
        run,
        running: state.stage === "matching" || state.stage === "asking",
        stage: state.stage,
        tier1Matched: state.tier1Matched,
        tier2Sent: state.tier2Sent,
        totalLabels: args.labels.length,
    };
}
