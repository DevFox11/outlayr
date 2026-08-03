import { useCallback, useEffect, useRef } from "react";
import {
	SUGGESTED_CATEGORY_PRESETS,
	type SuggestedCategoryPreset,
} from "@/data/categories-core";
import { setCachedEnrichment } from "@/domain/enrichment-cache";
import {
	type MerchantMatch,
	merchantKey,
	resolveMerchant,
} from "@/domain/merchant-resolver";

export interface PendingCategory {
	name: string;
	icon: string;
	color: string;
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
	knownCategoryNames: readonly string[];
	resolveLocal: (suggestion: EnrichmentSuggestion) => EnrichmentSuggestion;
	onSuggest: (suggestion: EnrichmentSuggestion) => void;
}

export interface UseTransactionEnrichmentResult {
	onNameChange: (next: string) => void;
	categoryPending: boolean;
	tagsPending: boolean;
}

const DEBOUNCE_MS = 600;
const MIN_KEY_LENGTH = 3;
/**
 * Matches the real Tier 2 client-abort budget (design P7 `Promise.race`
 * timeout) so a stubbed request stays "in flight" long enough for a later
 * request to genuinely supersede it, exercising the requestId-drop path for
 * real instead of asserting on an already-synchronous no-op.
 */
export const TIER2_STUB_DELAY_MS = 4000;

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

function toRawSuggestion(match: MerchantMatch): EnrichmentSuggestion {
	const preset = findCategoryPreset(match.categoryName);
	return {
		categoryId: null,
		pendingCategory: preset
			? { name: match.categoryName, icon: preset.icon, color: preset.color }
			: null,
		tagIds: [],
		pendingTagNames: match.tags,
		domain: match.domain,
		source: "curated",
	};
}

/**
 * Tier 2 (remote, gated, cached) ships in PR5 — see design P7 run() steps 3-7.
 * The real gates (settings toggle, signed-in, dedupe) and the real transport
 * call are PR5 scope; this stub only proves the requestId-drop mechanism
 * itself works, by resolving to a negative cache write after a real delay
 * instead of synchronously — a synchronous stub has nothing to race against.
 */
function scheduleTier2Stub(
	key: string,
	id: number,
	requestIdRef: { current: number },
): void {
	setTimeout(() => {
		if (id !== requestIdRef.current) {
			return;
		}
		setCachedEnrichment(key, null);
	}, TIER2_STUB_DELAY_MS);
}

export function useTransactionEnrichment(
	args: UseTransactionEnrichmentArgs,
): UseTransactionEnrichmentResult {
	const { enabled, knownCategoryNames, resolveLocal, onSuggest } = args;

	const nameRef = useRef("");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestIdRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);
	const inFlightRef = useRef<Map<string, Promise<unknown>>>(new Map());

	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const knownNamesRef = useRef(knownCategoryNames);
	knownNamesRef.current = knownCategoryNames;
	const resolveLocalRef = useRef(resolveLocal);
	resolveLocalRef.current = resolveLocal;
	const onSuggestRef = useRef(onSuggest);
	onSuggestRef.current = onSuggest;

	const emit = useCallback((match: MerchantMatch) => {
		const raw = toRawSuggestion(match);
		onSuggestRef.current(resolveLocalRef.current(raw));
	}, []);

	const run = useCallback(() => {
		const key = merchantKey(nameRef.current);
		if (key.length < MIN_KEY_LENGTH) {
			return;
		}
		const match = resolveMerchant(key);
		if (match != null) {
			emit(match);
			return;
		}
		const id = ++requestIdRef.current;
		scheduleTier2Stub(key, id, requestIdRef);
	}, [emit]);

	const onNameChange = useCallback(
		(next: string) => {
			nameRef.current = next;
			if (!enabledRef.current) {
				return;
			}
			if (timerRef.current != null) {
				clearTimeout(timerRef.current);
			}
			timerRef.current = setTimeout(run, DEBOUNCE_MS);
		},
		[run],
	);

	useEffect(() => {
		if (!enabled) {
			if (timerRef.current != null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			abortRef.current?.abort();
			requestIdRef.current += 1;
			inFlightRef.current.clear();
		}
	}, [enabled]);

	useEffect(
		() => () => {
			if (timerRef.current != null) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			abortRef.current?.abort();
			requestIdRef.current += 1;
			inFlightRef.current.clear();
		},
		[],
	);

	return { onNameChange, categoryPending: false, tagsPending: false };
}
