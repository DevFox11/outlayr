import { useCallback, useEffect, useRef, useState } from "react";
import { SUGGESTED_CATEGORY_PRESETS, type SuggestedCategoryPreset } from "@/data/categories-core";
import { getCachedEnrichment, type RemoteEnrichmentResult, setCachedEnrichment } from "@/domain/enrichment-cache";
import { type MerchantMatch, merchantKey, resolveMerchant } from "@/domain/merchant-resolver";
import { type CategoryBranch, type EnrichmentFn, enrichmentTransport } from "@/lib/convex";

export interface PendingCategory {
	color: string;
	emoji: string | null;
	icon: string;
	name: string;
	parentName: string | null;
}

export interface EnrichmentSuggestion {
	categoryId: string | null;
	domain: string | null;
	pendingCategory: PendingCategory | null;
	pendingTagNames: readonly string[];
	source: "curated" | "history" | "remote";
	tagIds: readonly string[];
}

const NOTHING: EnrichmentSuggestion = {
	categoryId: null,
	domain: null,
	pendingCategory: null,
	pendingTagNames: [],
	source: "curated",
	tagIds: [],
};

/**
 * The user's own ledger outranks the curated map and the model, including when
 * they disagree: a merchant this user has filed before is answered by their own
 * filing. Someone who consistently books Starbucks under Work means it, and
 * being corrected by a list every time is the annoyance this removes.
 *
 * Only the category is taken. The domain and tags still come from whichever
 * source found them, because history has no opinion about either.
 */
function withRemembered(suggestion: EnrichmentSuggestion, categoryId: string | null): EnrichmentSuggestion {
	if (categoryId == null) {
		return suggestion;
	}
	return { ...suggestion, categoryId, pendingCategory: null, source: "history" };
}

export interface UseTransactionEnrichmentArgs {
	categoryTree: readonly CategoryBranch[];
	enabled: boolean;
	/** The server re-checks the `groundedLookup` setting independently. */
	groundedLookup?: boolean;
	income: boolean;
	locale?: string;
	onSuggest: (suggestion: EnrichmentSuggestion) => void;
	/**
	 * The device's own region — a signal `locale` cannot substitute for, since a
	 * user may run an English UI on a device set to a different region.
	 */
	regionCode?: string;
	/** The `aiEnrichment` setting. False keeps every lookup on-device. */
	remoteEnabled?: boolean;
	/**
	 * What the ledger already knows about this merchant. Omitted in tests that
	 * are not about history, and absent for an entry being edited rather than
	 * created.
	 */
	resolveHistory?: (key: string, income: boolean) => Promise<string | null>;
	resolveLocal: (suggestion: EnrichmentSuggestion) => EnrichmentSuggestion;
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
const GROUNDED_RECHECK_MS = 8000;
const GROUNDED_RECHECK_RETRY_MS = 12_000;
const MIN_KEY_LENGTH = 3;
export const REMOTE_TIMEOUT_MS = 4000;

const ALL_CATEGORY_PRESETS: readonly SuggestedCategoryPreset[] = [
	...SUGGESTED_CATEGORY_PRESETS.expense,
	...SUGGESTED_CATEGORY_PRESETS.income,
];

function findCategoryPreset(categoryName: string): SuggestedCategoryPreset | null {
	return ALL_CATEGORY_PRESETS.find((preset) => preset.name === categoryName) ?? null;
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
	for (let index = 0; index < categoryName.length; index += 1) {
		// biome-ignore lint/suspicious/noBitwiseOperators: `>>> 0` truncates the running product to uint32, which is what keeps this hash from drifting into float precision and producing a different preset on a longer name.
		hash = (hash * 31 + categoryName.charCodeAt(index)) >>> 0;
	}
	return ALL_CATEGORY_PRESETS[hash % ALL_CATEGORY_PRESETS.length];
}

function toCuratedSuggestion(match: MerchantMatch): EnrichmentSuggestion {
	const preset = findCategoryPreset(match.categoryName);
	return {
		categoryId: null,
		domain: match.domain,
		pendingCategory: preset
			? {
					color: preset.color,
					emoji: null,
					icon: preset.icon,
					name: match.categoryName,
					// The curated map only ever names top-level categories.
					parentName: null,
				}
			: null,
		pendingTagNames: match.tags,
		source: "curated",
		tagIds: [],
	};
}

function toRemoteSuggestion(result: RemoteEnrichmentResult): EnrichmentSuggestion {
	const preset = result.categoryName == null ? null : presetForName(result.categoryName);
	return {
		categoryId: null,
		domain: result.domain,
		pendingCategory:
			result.categoryName == null || preset == null
				? null
				: {
						color: preset.color,
						emoji: result.emoji ?? null,
						icon: preset.icon,
						name: result.categoryName,
						parentName: result.parentCategoryName ?? null,
					},
		pendingTagNames: result.tags,
		source: "remote",
		tagIds: [],
	};
}

export function useTransactionEnrichment(args: UseTransactionEnrichmentArgs): UseTransactionEnrichmentResult {
	const {
		enabled,
		income,
		categoryTree,
		resolveLocal,
		resolveHistory,
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
	const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const requestIdRef = useRef(0);
	const inFlightRef = useRef<Set<string>>(new Set());
	const lastRemoteOutcomeRef = useRef<{
		key: string;
		hasDomain: boolean;
	} | null>(null);
	/**
	 * A domain-less curated hit keeps its category and tags authoritative while
	 * the remote tier is only ever consulted for the domain — the model must
	 * never overwrite the map's judgement.
	 */
	const curatedFallbackRef = useRef<{
		key: string;
		suggestion: EnrichmentSuggestion;
	} | null>(null);

	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const incomeRef = useRef(income);
	incomeRef.current = income;
	const treeRef = useRef(categoryTree);
	treeRef.current = categoryTree;
	const resolveLocalRef = useRef(resolveLocal);
	resolveLocalRef.current = resolveLocal;
	const resolveHistoryRef = useRef(resolveHistory);
	resolveHistoryRef.current = resolveHistory;
	/**
	 * Keyed, because a remote answer can land after the field has moved on to a
	 * different merchant — the same reason `emitDomainResult` re-checks the key.
	 */
	const rememberedRef = useRef<{ categoryId: string | null; key: string } | null>(null);
	/** What the tiers last said, so a late ledger answer can be merged onto it. */
	const lastEmittedRef = useRef<{ key: string; suggestion: EnrichmentSuggestion } | null>(null);
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

	/** Only while the field still holds the merchant the lookup was made for. */
	const rememberedNow = useCallback((): string | null => {
		const held = rememberedRef.current;
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the object assigned in `recallFromLedger`.
		if (held == null || held.key !== merchantKey(nameRef.current)) {
			return null;
		}
		return held.categoryId;
	}, []);

	const emit = useCallback(
		(suggestion: EnrichmentSuggestion) => {
			lastEmittedRef.current = { key: merchantKey(nameRef.current), suggestion };
			onSuggestRef.current(resolveLocalRef.current(withRemembered(suggestion, rememberedNow())));
		},
		[rememberedNow]
	);

	/**
	 * A name nobody can answer for still has to be reported. Staying silent
	 * leaves the previous merchant's category, tags and logo sitting on an entry
	 * they have nothing to do with.
	 */
	const emitNothing = useCallback(() => {
		emit(NOTHING);
	}, [emit]);

	/**
	 * Runs alongside the tiers rather than ahead of them, and re-emits over
	 * whatever they last said.
	 *
	 * Awaiting it first would be simpler, but the curated tier is synchronous on
	 * purpose — it is the instant on-device answer — and a local read is not a
	 * good enough reason for that to stop being true.
	 */
	const recallFromLedger = useCallback(async (key: string) => {
		const resolve = resolveHistoryRef.current;
		if (resolve == null) {
			rememberedRef.current = { categoryId: null, key };
			return;
		}
		const categoryId = await resolve(key, incomeRef.current);
		if (merchantKey(nameRef.current) !== key) {
			return;
		}
		rememberedRef.current = { categoryId, key };
		if (categoryId == null) {
			return;
		}
		const last = lastEmittedRef.current;
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the object assigned in `emit`.
		const base = last != null && last.key === key ? last.suggestion : NOTHING;
		onSuggestRef.current(resolveLocalRef.current(withRemembered(base, categoryId)));
	}, []);

	const resolveTransport = useCallback(
		() => (transportRef.current === undefined ? enrichmentTransport() : transportRef.current),
		[]
	);

	const buildRequest = useCallback(
		(grounded: boolean) => ({
			categoryTree: treeRef.current.map((branch) => ({
				children: [...branch.children],
				name: branch.name,
			})),
			groundedLookup: grounded,
			income: incomeRef.current,
			locale: localeRef.current,
			name: nameRef.current.trim(),
			regionCode: regionCodeRef.current,
		}),
		[]
	);

	const emitDomainResult = useCallback(
		(key: string, result: RemoteEnrichmentResult | null): boolean => {
			if (result?.domain == null || merchantKey(nameRef.current) !== key) {
				return false;
			}
			if (result.grounding !== true) {
				setCachedEnrichment(key, result);
			}
			const fallback = curatedFallbackRef.current;
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the assignment in `run`.
			if (fallback != null && fallback.key === key) {
				emit({ ...fallback.suggestion, domain: result.domain });
			} else {
				emit(toRemoteSuggestion(result));
			}
			return true;
		},
		[emit]
	);

	const emitRemoteResult = useCallback(
		(key: string, result: RemoteEnrichmentResult | null) => {
			const fallback = curatedFallbackRef.current;
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the assignment in `run`.
			if (fallback != null && fallback.key === key) {
				if (result?.domain != null) {
					emit({ ...fallback.suggestion, domain: result.domain });
				}
				return;
			}
			if (result == null) {
				emitNothing();
				return;
			}
			emit(toRemoteSuggestion(result));
		},
		[emit, emitNothing]
	);

	const runRemote = useCallback(
		async (key: string) => {
			const call = resolveTransport();
			if (call == null) {
				return;
			}
			requestIdRef.current += 1;
			const id = requestIdRef.current;
			inFlightRef.current.add(key);
			setPending(true);
			let result: RemoteEnrichmentResult | null = null;
			try {
				result = await Promise.race([
					// The fast tier never requests grounding — see
					// `runGroundedFollowUp` for the idle-gated retry.
					call(buildRequest(false)),
					new Promise<null>((resolve) => {
						setTimeout(() => resolve(null), REMOTE_TIMEOUT_MS);
					}),
				]);
			} catch {
				result = null;
			}
			inFlightRef.current.delete(key);
			lastRemoteOutcomeRef.current = { hasDomain: result?.domain != null, key };
			if (id !== requestIdRef.current) {
				return;
			}
			setPending(false);
			if (result?.grounding !== true) {
				setCachedEnrichment(key, result);
			}
			emitRemoteResult(key, result);
		},
		[emitRemoteResult, resolveTransport, buildRequest]
	);

	/** A fast result that already carried a domain suppresses this follow-up entirely. */
	const runGroundedFollowUp = useCallback(async () => {
		if (!groundedLookupRef.current) {
			return;
		}
		const key = merchantKey(nameRef.current);
		const outcome = lastRemoteOutcomeRef.current;
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the assignment in `runRemote`.
		if (outcome == null || outcome.key !== key || outcome.hasDomain) {
			return;
		}
		const call = resolveTransport();
		if (call == null) {
			return;
		}
		const ticket = requestIdRef.current;
		const stale = () => ticket !== requestIdRef.current || merchantKey(nameRef.current) !== key;
		let result: RemoteEnrichmentResult | null = null;
		try {
			result = await call(buildRequest(true));
		} catch {
			result = null;
		}
		if (stale()) {
			return;
		}
		if (emitDomainResult(key, result) || result?.grounding !== true) {
			return;
		}
		const scheduleRecheck = (delay: number, retriesLeft: number) => {
			recheckTimerRef.current = setTimeout(async () => {
				let rechecked: RemoteEnrichmentResult | null = null;
				try {
					rechecked = await call({
						...buildRequest(false),
						knowledgeOnly: true,
					});
				} catch {
					rechecked = null;
				}
				if (stale() || emitDomainResult(key, rechecked)) {
					return;
				}
				if (retriesLeft > 0) {
					scheduleRecheck(GROUNDED_RECHECK_RETRY_MS, retriesLeft - 1);
				}
			}, delay);
		};
		scheduleRecheck(GROUNDED_RECHECK_MS, 1);
	}, [resolveTransport, buildRequest, emitDomainResult]);

	const run = useCallback(async () => {
		const key = merchantKey(nameRef.current);
		if (key.length < MIN_KEY_LENGTH) {
			rememberedRef.current = null;
			emitNothing();
			return;
		}
		// Deliberately not awaited: the curated tier below is synchronous, and a
		// local read must not be what makes it stop being.
		// biome-ignore lint/complexity/noVoid: marks the floating promise as intentional rather than a forgotten await.
		void recallFromLedger(key);
		const match = resolveMerchant(key);
		let curatedFallback = false;
		if (match != null) {
			const curatedSuggestion = toCuratedSuggestion(match);
			emit(curatedSuggestion);
			if (match.domain != null) {
				return;
			}
			curatedFallback = true;
			curatedFallbackRef.current = { key, suggestion: curatedSuggestion };
		}
		if (!remoteEnabledRef.current) {
			if (!curatedFallback) {
				emitNothing();
			}
			return;
		}
		const cached = getCachedEnrichment(key);
		if (cached.hit) {
			emitRemoteResult(key, cached.value);
			return;
		}
		if (inFlightRef.current.has(key)) {
			return;
		}
		await runRemote(key);
	}, [emit, emitNothing, emitRemoteResult, recallFromLedger, runRemote]);

	const onNameChange = useCallback(
		(next: string) => {
			nameRef.current = next;
			if (!enabledRef.current) {
				return;
			}
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned below.
			if (timerRef.current != null) {
				clearTimeout(timerRef.current);
			}
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned below.
			if (groundedTimerRef.current != null) {
				clearTimeout(groundedTimerRef.current);
			}
			// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned in `runGroundedFollowUp`.
			if (recheckTimerRef.current != null) {
				clearTimeout(recheckTimerRef.current);
				recheckTimerRef.current = null;
			}
			timerRef.current = setTimeout(run, DEBOUNCE_MS);
			groundedTimerRef.current = setTimeout(runGroundedFollowUp, GROUNDED_IDLE_MS);
		},
		[run, runGroundedFollowUp]
	);

	const teardown = useCallback(() => {
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned in `onNameChange`.
		if (timerRef.current != null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned in `onNameChange`.
		if (groundedTimerRef.current != null) {
			clearTimeout(groundedTimerRef.current);
			groundedTimerRef.current = null;
		}
		// biome-ignore lint/suspicious/noUnnecessaryConditions: Biome reads `.current` off useRef's `null` initialiser and drops the explicit type argument, so it cannot see the setTimeout handle assigned in `runGroundedFollowUp`.
		if (recheckTimerRef.current != null) {
			clearTimeout(recheckTimerRef.current);
			recheckTimerRef.current = null;
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
