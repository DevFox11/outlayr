import { useCallback, useEffect, useRef, useState } from "react";
import {
	SUGGESTED_CATEGORY_PRESETS,
	type SuggestedCategoryPreset,
} from "@/data/categories-core";
import {
	getCachedEnrichment,
	type RemoteEnrichmentResult,
	setCachedEnrichment,
} from "@/domain/enrichment-cache";
import {
	type MerchantMatch,
	merchantKey,
	resolveMerchant,
} from "@/domain/merchant-resolver";
import {
	type CategoryBranch,
	type EnrichmentFn,
	enrichmentTransport,
} from "@/lib/convex";

export interface PendingCategory {
	name: string;
	icon: string;
	color: string;
	emoji: string | null;
	parentName: string | null;
}

export interface EnrichmentSuggestion {
	categoryId: string | null;
	pendingCategory: PendingCategory | null;
	tagIds: readonly string[];
	pendingTagNames: readonly string[];
	domain: string | null;
	source: "curated" | "remote";
}

export interface UseTransactionEnrichmentArgs {
	enabled: boolean;
	income: boolean;
	categoryTree: readonly CategoryBranch[];
	resolveLocal: (suggestion: EnrichmentSuggestion) => EnrichmentSuggestion;
	onSuggest: (suggestion: EnrichmentSuggestion) => void;
	/** The `aiEnrichment` setting. False keeps every lookup on-device. */
	remoteEnabled?: boolean;
	locale?: string;
	/**
	 * The device's own region — a signal `locale` cannot substitute for, since a
	 * user may run an English UI on a device set to a different region.
	 */
	regionCode?: string;
	/** The server re-checks the `groundedLookup` setting independently. */
	groundedLookup?: boolean;
	/** Injected in tests; production resolves the real Convex call. */
	transport?: EnrichmentFn | null;
}

export interface UseTransactionEnrichmentResult {
	onNameChange: (next: string) => void;
	/**
	 * A remote lookup is outstanding. The form decides which rows may show it —
	 * a field the user has already edited is theirs, so it never dims.
	 */
	pending: boolean;
}

const DEBOUNCE_MS = 600;
/**
 * A grounded search costs ~3x more than assumed (measured: one answer bills 3
 * search calls). Waiting this much longer than `DEBOUNCE_MS` before allowing
 * it means a mid-name pause (e.g. "Rio" before "rio supermercado" finishes)
 * never spends a grounded lookup on a fragment.
 */
const GROUNDED_IDLE_MS = 1800;
const MIN_KEY_LENGTH = 3;
export const REMOTE_TIMEOUT_MS = 4000;

const ALL_CATEGORY_PRESETS: readonly SuggestedCategoryPreset[] = [
	...SUGGESTED_CATEGORY_PRESETS.expense,
	...SUGGESTED_CATEGORY_PRESETS.income,
];

function findCategoryPreset(
	categoryName: string,
): SuggestedCategoryPreset | null {
	return (
		ALL_CATEGORY_PRESETS.find((preset) => preset.name === categoryName) ?? null
	);
}

/**
 * A model may name a category no preset covers. Hashing the name rather than
 * picking at random keeps the same suggestion looking the same on every device
 * and across re-renders, so the chip does not change colour under the user.
 */
function presetForName(categoryName: string): SuggestedCategoryPreset {
	const exact = findCategoryPreset(categoryName);
	if (exact != null) {
		return exact;
	}
	let hash = 0;
	for (let index = 0; index < categoryName.length; index++) {
		hash = (hash * 31 + categoryName.charCodeAt(index)) >>> 0;
	}
	return ALL_CATEGORY_PRESETS[hash % ALL_CATEGORY_PRESETS.length];
}

function toCuratedSuggestion(match: MerchantMatch): EnrichmentSuggestion {
	const preset = findCategoryPreset(match.categoryName);
	return {
		categoryId: null,
		pendingCategory: preset
			? {
					name: match.categoryName,
					icon: preset.icon,
					color: preset.color,
					emoji: null,
					// The curated map only ever names top-level categories.
					parentName: null,
				}
			: null,
		tagIds: [],
		pendingTagNames: match.tags,
		domain: match.domain,
		source: "curated",
	};
}

function toRemoteSuggestion(
	result: RemoteEnrichmentResult,
): EnrichmentSuggestion {
	const preset =
		result.categoryName == null ? null : presetForName(result.categoryName);
	return {
		categoryId: null,
		pendingCategory:
			result.categoryName == null || preset == null
				? null
				: {
						name: result.categoryName,
						icon: preset.icon,
						color: preset.color,
						emoji: result.emoji ?? null,
						parentName: result.parentCategoryName ?? null,
					},
		tagIds: [],
		pendingTagNames: result.tags,
		domain: result.domain,
		source: "remote",
	};
}

export function useTransactionEnrichment(
	args: UseTransactionEnrichmentArgs,
): UseTransactionEnrichmentResult {
	const {
		enabled,
		income,
		categoryTree,
		resolveLocal,
		onSuggest,
		remoteEnabled = true,
		locale,
		regionCode,
		groundedLookup = true,
		transport,
	} = args;

	const [pending, setPending] = useState(false);

	const nameRef = useRef("");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const groundedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestIdRef = useRef(0);
	const inFlightRef = useRef<Set<string>>(new Set());
	const lastRemoteOutcomeRef = useRef<{
		key: string;
		hasDomain: boolean;
	} | null>(null);

	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const incomeRef = useRef(income);
	incomeRef.current = income;
	const treeRef = useRef(categoryTree);
	treeRef.current = categoryTree;
	const resolveLocalRef = useRef(resolveLocal);
	resolveLocalRef.current = resolveLocal;
	const onSuggestRef = useRef(onSuggest);
	onSuggestRef.current = onSuggest;
	const remoteEnabledRef = useRef(remoteEnabled);
	remoteEnabledRef.current = remoteEnabled;
	const localeRef = useRef(locale);
	localeRef.current = locale;
	const regionCodeRef = useRef(regionCode);
	regionCodeRef.current = regionCode;
	const groundedLookupRef = useRef(groundedLookup);
	groundedLookupRef.current = groundedLookup;
	const transportRef = useRef<EnrichmentFn | null | undefined>(transport);
	transportRef.current = transport;

	const emit = useCallback((suggestion: EnrichmentSuggestion) => {
		onSuggestRef.current(resolveLocalRef.current(suggestion));
	}, []);

	/**
	 * A name nobody can answer for still has to be reported. Staying silent
	 * leaves the previous merchant's category, tags and logo sitting on an entry
	 * they have nothing to do with.
	 */
	const emitNothing = useCallback(() => {
		onSuggestRef.current({
			categoryId: null,
			pendingCategory: null,
			tagIds: [],
			pendingTagNames: [],
			domain: null,
			source: "curated",
		});
	}, []);

	const runRemote = useCallback(
		async (key: string) => {
			const call =
				transportRef.current === undefined
					? enrichmentTransport()
					: transportRef.current;
			if (call == null) {
				return;
			}
			const id = ++requestIdRef.current;
			inFlightRef.current.add(key);
			setPending(true);
			let result: RemoteEnrichmentResult | null = null;
			try {
				result = await Promise.race([
					call({
						name: nameRef.current.trim(),
						income: incomeRef.current,
						locale: localeRef.current,
						regionCode: regionCodeRef.current,
						categoryTree: treeRef.current.map((branch) => ({
							name: branch.name,
							children: [...branch.children],
						})),
						// The fast tier never requests grounding — see
						// `runGroundedFollowUp` for the idle-gated retry.
						groundedLookup: false,
					}),
					new Promise<null>((resolve) => {
						setTimeout(() => resolve(null), REMOTE_TIMEOUT_MS);
					}),
				]);
			} catch {
				result = null;
			}
			inFlightRef.current.delete(key);
			lastRemoteOutcomeRef.current = { key, hasDomain: result?.domain != null };
			if (id !== requestIdRef.current) {
				return;
			}
			setPending(false);
			if (result?.grounding !== true) {
				setCachedEnrichment(key, result);
			}
			if (result == null) {
				emitNothing();
				return;
			}
			emit(toRemoteSuggestion(result));
		},
		[emit, emitNothing],
	);

	/** A fast result that already carried a domain suppresses this follow-up entirely. */
	const runGroundedFollowUp = useCallback(() => {
		if (!groundedLookupRef.current) {
			return;
		}
		const key = merchantKey(nameRef.current);
		const outcome = lastRemoteOutcomeRef.current;
		if (outcome == null || outcome.key !== key || outcome.hasDomain) {
			return;
		}
		const call =
			transportRef.current === undefined
				? enrichmentTransport()
				: transportRef.current;
		if (call == null) {
			return;
		}
		void call({
			name: nameRef.current.trim(),
			income: incomeRef.current,
			locale: localeRef.current,
			regionCode: regionCodeRef.current,
			categoryTree: treeRef.current.map((branch) => ({
				name: branch.name,
				children: [...branch.children],
			})),
			groundedLookup: true,
		});
	}, []);

	const run = useCallback(() => {
		const key = merchantKey(nameRef.current);
		if (key.length < MIN_KEY_LENGTH) {
			emitNothing();
			return;
		}
		const match = resolveMerchant(key);
		if (match != null) {
			emit(toCuratedSuggestion(match));
			return;
		}
		if (!remoteEnabledRef.current) {
			emitNothing();
			return;
		}
		const cached = getCachedEnrichment(key);
		if (cached.hit) {
			if (cached.value == null) {
				emitNothing();
				return;
			}
			emit(toRemoteSuggestion(cached.value));
			return;
		}
		if (inFlightRef.current.has(key)) {
			return;
		}
		void runRemote(key);
	}, [emit, emitNothing, runRemote]);

	const onNameChange = useCallback(
		(next: string) => {
			nameRef.current = next;
			if (!enabledRef.current) {
				return;
			}
			if (timerRef.current != null) {
				clearTimeout(timerRef.current);
			}
			if (groundedTimerRef.current != null) {
				clearTimeout(groundedTimerRef.current);
			}
			timerRef.current = setTimeout(run, DEBOUNCE_MS);
			groundedTimerRef.current = setTimeout(
				runGroundedFollowUp,
				GROUNDED_IDLE_MS,
			);
		},
		[run, runGroundedFollowUp],
	);

	const teardown = useCallback(() => {
		if (timerRef.current != null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (groundedTimerRef.current != null) {
			clearTimeout(groundedTimerRef.current);
			groundedTimerRef.current = null;
		}
		requestIdRef.current += 1;
		inFlightRef.current.clear();
		setPending(false);
	}, []);

	useEffect(() => {
		if (!enabled) {
			teardown();
		}
	}, [enabled, teardown]);

	useEffect(() => () => teardown(), [teardown]);

	return { onNameChange, pending };
}
