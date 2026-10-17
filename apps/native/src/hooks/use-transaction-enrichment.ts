import { useCallback, useEffect, useRef, useState } from "react";

import { findCategoryPreset, presetForName } from "@/data/categories-core";
import { getCachedEnrichment, setCachedEnrichment } from "@/domain/enrichment-cache";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";
import { merchantKey, resolveMerchant } from "@/domain/merchant-resolver";
import type { MerchantMatch } from "@/domain/merchant-resolver";
import { enrichmentTransport } from "@/lib/convex";
import type { CategoryBranch, EnrichmentFn } from "@/lib/convex";
import { withTimeout } from "@/lib/with-timeout";

const noop = () => undefined;

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
    /** The entry's currency, sent as a locator for the merchant. */
    currency?: string;
    enabled: boolean;
    /** The server re-checks the `groundedLookup` setting independently. */
    groundedLookup?: boolean;
    income: boolean;
    /**
     * The merchant the form opened with. Seeds the name the tiers read without
     * asking anything, so an edit whose currency changes, or whose owner asks
     * for a lookup, resolves the name on screen rather than an empty one.
     */
    initialName?: string;
    locale?: string;
    onSuggest: (suggestion: EnrichmentSuggestion) => void;
    /**
     * The device's own region — a signal `locale` cannot substitute for, since a
     * user may run an English UI on a device set to a different region.
     */
    regionCode?: string;
    /** `remoteEnrichmentOn`: AI providers allowed and suggestions on. False keeps every lookup on-device. */
    remoteEnabled?: boolean;
    /**
     * What the ledger already knows about this merchant. Omitted in tests that
     * are not about history, and absent for an entry being edited rather than
     * created.
     */
    resolveHistory?: (key: string, income: boolean) => Promise<string | null>;
    resolveLocal: (suggestion: EnrichmentSuggestion) => EnrichmentSuggestion;
    recallMerchant?: (name: string, currency: string | undefined) => Promise<RemoteEnrichmentResult | null>;
    /**
     * An on-device tier consulted between the curated map and the model, for a
     * domain the curated map has no opinion about. Answering here skips the
     * remote call entirely.
     *
     * The account editor passes the institution map; the transaction form
     * passes nothing, so its tiers are unchanged.
     */
    resolveDomain?: (key: string) => string | null;
    /** Injected in tests; production resolves the real Convex call. */
    transport?: EnrichmentFn | null;
}

export interface UseTransactionEnrichmentResult {
    /**
     * Asks the curated map and the model for the name on screen right now,
     * past the debounce, the session cache and the ledger: what this device
     * already answered is exactly what the caller is dissatisfied with. The
     * grounded follow-up runs as soon as the fast pass settles without a domain.
     */
    lookupNow: () => Promise<void>;
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
export const REMOTE_TIMEOUT_MS = 9000;

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
        initialName,
        categoryTree,
        currency,
        resolveLocal,
        resolveHistory,
        resolveDomain,
        recallMerchant,
        onSuggest,
        remoteEnabled = true,
        locale,
        regionCode,
        groundedLookup = true,
        transport,
    } = args;

    const [pending, setPending] = useState(false);
    /**
     * A `lookupNow` in progress, fast pass and grounded follow-up included.
     * `pending` alone drops between the two, which would offer the button
     * again while the follow-up is still out.
     */
    const [forcing, setForcing] = useState(false);

    const nameRef = useRef(initialName ?? "");
    /** Set by `lookupNow` for the one `run` it starts; read and cleared there. */
    const forceRef = useRef(false);
    /** Mirrors `forcing` for the tap that lands before the state commits. */
    const forcingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const groundedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const groundedFollowUpRef = useRef<() => void>(noop);
    const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearTimers = useCallback(() => {
        for (const ref of [timerRef, groundedTimerRef, recheckTimerRef]) {
            if (ref.current != null) {
                clearTimeout(ref.current);
                ref.current = null;
            }
        }
    }, []);
    const requestIdRef = useRef(0);
    /**
     * Key -> the request ticket that owns it. Ticketed rather than a bare set
     * because a superseded request still settles: it must not delete an entry a
     * LATER request for the same key now owns, or a third lookup starts and the
     * dedupe stops meaning anything.
     */
    const inFlightRef = useRef<Map<string, number>>(new Map());
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

    /**
     * Keyed, because a remote answer can land after the field has moved on to a
     * different merchant — the same reason `emitDomainResult` re-checks the key.
     */
    const rememberedRef = useRef<{ categoryId: string | null; key: string } | null>(null);
    /** What the tiers last said, so a late ledger answer can be merged onto it. */
    const lastEmittedRef = useRef<{ key: string; suggestion: EnrichmentSuggestion } | null>(null);

    /**
     * The arguments as of the last commit. The lookup pipeline is a chain of
     * timers and awaits that outlives the render that started it, so every tier
     * reads the current arguments from here rather than closing over a render's
     * copy. Mirrored in an effect, not during render: a ref written while
     * rendering is a side effect the compiler cannot follow, and every read
     * happens after commit anyway.
     */
    const resolved = {
        categoryTree,
        currency,
        enabled,
        groundedLookup,
        income,
        locale,
        onSuggest,
        recallMerchant,
        regionCode,
        remoteEnabled,
        resolveDomain,
        resolveHistory,
        resolveLocal,
        transport,
    };
    const latest = useRef(resolved);
    useEffect(() => {
        latest.current = resolved;
    });

    /** Only while the field still holds the merchant the lookup was made for. */
    const rememberedNow = useCallback((): string | null => {
        const held = rememberedRef.current;
        if (held == null || held.key !== merchantKey(nameRef.current)) {
            return null;
        }
        return held.categoryId;
    }, []);

    const emit = useCallback(
        (suggestion: EnrichmentSuggestion) => {
            lastEmittedRef.current = { key: merchantKey(nameRef.current), suggestion };
            latest.current.onSuggest(latest.current.resolveLocal(withRemembered(suggestion, rememberedNow())));
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
        const resolve = latest.current.resolveHistory;
        if (resolve == null) {
            rememberedRef.current = { categoryId: null, key };
            return;
        }
        const categoryId = await resolve(key, latest.current.income);
        if (merchantKey(nameRef.current) !== key) {
            return;
        }
        rememberedRef.current = { categoryId, key };
        if (categoryId == null) {
            return;
        }
        const last = lastEmittedRef.current;
        const base = last != null && last.key === key ? last.suggestion : NOTHING;
        latest.current.onSuggest(latest.current.resolveLocal(withRemembered(base, categoryId)));
    }, []);

    const resolveTransport = useCallback(
        () => (latest.current.transport === undefined ? enrichmentTransport() : latest.current.transport),
        []
    );

    const buildRequest = useCallback(
        (grounded: boolean) => ({
            categoryTree: latest.current.categoryTree.map((branch) => ({
                children: [...branch.children],
                name: branch.name,
            })),
            currency: latest.current.currency,
            groundedLookup: grounded,
            income: latest.current.income,
            locale: latest.current.locale,
            name: nameRef.current.trim(),
            regionCode: latest.current.regionCode,
        }),
        []
    );

    /**
     * `askedIn` is the currency the request was made with, not the one on
     * screen: a response is filed under the locator that produced it, or a
     * currency change mid-flight would cache the old country's answer in the
     * new partition and the re-ask would then hit it.
     */
    const emitDomainResult = useCallback(
        (key: string, result: RemoteEnrichmentResult | null, askedIn: string | undefined): boolean => {
            if (result?.domain == null || merchantKey(nameRef.current) !== key) {
                return false;
            }
            if (result.grounding !== true) {
                setCachedEnrichment(key, result, askedIn);
            }
            const fallback = curatedFallbackRef.current;
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
            inFlightRef.current.set(key, id);
            setPending(true);
            // The fast tier never requests grounding — see `runGroundedFollowUp`
            // for the idle-gated retry.
            const request = buildRequest(false);
            let result: RemoteEnrichmentResult | null = null;
            try {
                result = await withTimeout(call(request), REMOTE_TIMEOUT_MS, null);
            } catch {
                result = null;
            }
            // Only if this request still owns the entry — see `inFlightRef`.
            if (inFlightRef.current.get(key) === id) {
                inFlightRef.current.delete(key);
            }
            if (id !== requestIdRef.current) {
                return;
            }
            if (result?.grounding !== true) {
                setCachedEnrichment(key, result, request.currency);
            }
            // The field moved on while this was out and the replacement has not
            // started yet (its debounce is still running): the answer is kept
            // for the cache above and must not be painted onto the new name.
            if (merchantKey(nameRef.current) !== key) {
                setPending(false);
                return;
            }
            // Below the ticket check: `runGroundedFollowUp` reads this to decide
            // whether the fast pass for the name ON SCREEN already found a
            // domain. A superseded request recording its outcome here would
            // answer for a name the user has left, and either suppress the
            // grounded follow-up the current result deserves or spend one it
            // does not.
            lastRemoteOutcomeRef.current = { hasDomain: result?.domain != null, key };
            setPending(false);
            emitRemoteResult(key, result);
        },
        [emitRemoteResult, resolveTransport, buildRequest]
    );

    /** A fast result that already carried a domain suppresses this follow-up entirely. */
    const runGroundedFollowUp = useCallback(async () => {
        // `remoteEnabled` too: a merchant the ledger already knew records an
        // outcome without asking anyone, and must not send its name from here.
        if (!latest.current.groundedLookup || !latest.current.remoteEnabled) {
            return;
        }
        const key = merchantKey(nameRef.current);
        const outcome = lastRemoteOutcomeRef.current;
        if (outcome == null || outcome.key !== key) {
            if (inFlightRef.current.has(key)) {
                groundedTimerRef.current = setTimeout(() => groundedFollowUpRef.current(), GROUNDED_IDLE_MS);
            }
            return;
        }
        if (outcome.hasDomain) {
            return;
        }
        const call = resolveTransport();
        if (call == null) {
            return;
        }
        const ticket = requestIdRef.current;
        const request = buildRequest(true);
        const stale = () =>
            ticket !== requestIdRef.current ||
            merchantKey(nameRef.current) !== key ||
            latest.current.currency !== request.currency;
        let result: RemoteEnrichmentResult | null = null;
        try {
            result = await call(request);
        } catch {
            result = null;
        }
        if (stale()) {
            return;
        }
        if (emitDomainResult(key, result, request.currency) || result?.grounding !== true) {
            return;
        }
        const scheduleRecheck = (delay: number, retriesLeft: number) => {
            recheckTimerRef.current = setTimeout(async () => {
                let rechecked: RemoteEnrichmentResult | null = null;
                try {
                    rechecked = await call({
                        ...request,
                        groundedLookup: false,
                        knowledgeOnly: true,
                    });
                } catch {
                    rechecked = null;
                }
                if (stale() || emitDomainResult(key, rechecked, request.currency)) {
                    return;
                }
                if (retriesLeft > 0) {
                    scheduleRecheck(GROUNDED_RECHECK_RETRY_MS, retriesLeft - 1);
                }
            }, delay);
        };
        scheduleRecheck(GROUNDED_RECHECK_MS, 1);
    }, [resolveTransport, buildRequest, emitDomainResult]);

    /**
     * An answer `run` reaches without asking the model is final, so anything
     * still outstanding has to stop counting as current.
     *
     * `runRemote` bumps this ticket itself, which is what used to invalidate an
     * earlier request — every lookup ended there. Now that several tiers answer
     * and return first, a settling older request would otherwise pass
     * `runRemote`'s own `id !== requestIdRef.current` check and emit the
     * PREVIOUS name's suggestion over the one on screen: in the account editor
     * that is the last merchant's logo landing on this account.
     *
     * The in-flight-dedupe return is deliberately not a caller — a request for
     * THIS key is the answer being waited on, not a stale one.
     */
    const supersedeInFlight = useCallback(() => {
        requestIdRef.current += 1;
        // The dedupe set goes with the ticket. A superseded request's result is
        // discarded when it settles, so leaving its key here would make `run`
        // refuse to start the replacement the user actually needs — return to
        // that name before the abandoned call finishes and nothing would answer
        // it, stranding the previous tier's logo on screen. At most one
        // un-superseded request exists at a time, because `runRemote` bumps the
        // ticket as it starts, so clearing cannot drop a live one.
        inFlightRef.current.clear();
        setPending(false);
    }, []);

    const run = useCallback(async () => {
        // Read first: every early return below is a final answer, and a force
        // left standing would bypass the cache for the next keystroke's lookup.
        const force = forceRef.current;
        forceRef.current = false;
        const key = merchantKey(nameRef.current);
        if (key.length < MIN_KEY_LENGTH) {
            supersedeInFlight();
            rememberedRef.current = null;
            emitNothing();
            return;
        }
        if (force) {
            // The ledger is what the user filed before, and a lookup they asked
            // for is a request to hear the other tiers over it.
            rememberedRef.current = { categoryId: null, key };
        } else {
            // Deliberately not awaited: the curated tier below is synchronous, and a
            // local read must not be what makes it stop being.
            // oxlint-disable-next-line no-void -- marks the floating promise as intentional rather than a forgotten await.
            void recallFromLedger(key);
        }
        const match = resolveMerchant(key);
        let curatedFallback = false;
        if (match != null) {
            const curatedSuggestion = toCuratedSuggestion(match);
            emit(curatedSuggestion);
            if (match.domain != null) {
                supersedeInFlight();
                return;
            }
            curatedFallback = true;
            curatedFallbackRef.current = { key, suggestion: curatedSuggestion };
        }
        // On-device and exact, so it answers before the model is asked at all —
        // an account named after a bank costs no round trip and works offline.
        const localDomain = latest.current.resolveDomain?.(key) ?? null;
        if (localDomain != null) {
            const base = curatedFallback ? curatedFallbackRef.current?.suggestion : undefined;
            emit({ ...(base ?? NOTHING), domain: localDomain });
            supersedeInFlight();
            return;
        }
        const recalled = force
            ? null
            : ((await latest.current.recallMerchant?.(nameRef.current, latest.current.currency)) ?? null);
        if (merchantKey(nameRef.current) !== key) {
            return;
        }
        if (recalled != null) {
            lastRemoteOutcomeRef.current = { hasDomain: recalled.domain != null, key };
            emitRemoteResult(key, recalled);
            supersedeInFlight();
            return;
        }
        if (!latest.current.remoteEnabled) {
            if (!curatedFallback) {
                emitNothing();
            }
            supersedeInFlight();
            return;
        }
        const cached = force ? { hit: false as const } : getCachedEnrichment(key, latest.current.currency);
        if (cached.hit) {
            // Recorded as the fast outcome it once was, so a cached answer with
            // no domain still earns the grounded follow-up — the search it
            // scheduled back then may have published one since.
            lastRemoteOutcomeRef.current = { hasDomain: cached.value?.domain != null, key };
            emitRemoteResult(key, cached.value);
            supersedeInFlight();
            return;
        }
        if (inFlightRef.current.has(key)) {
            if (!force) {
                return;
            }
            // The outstanding request may be the debounced one for this same
            // name; the forced ask replaces it rather than waiting on it.
            supersedeInFlight();
        }
        await runRemote(key);
    }, [emit, emitNothing, emitRemoteResult, recallFromLedger, runRemote, supersedeInFlight]);

    useEffect(() => {
        groundedFollowUpRef.current = runGroundedFollowUp;
    }, [runGroundedFollowUp]);

    const onNameChange = useCallback(
        (next: string) => {
            nameRef.current = next;
            if (!latest.current.enabled) {
                return;
            }
            clearTimers();
            timerRef.current = setTimeout(run, DEBOUNCE_MS);
            groundedTimerRef.current = setTimeout(runGroundedFollowUp, GROUNDED_IDLE_MS);
        },
        [clearTimers, run, runGroundedFollowUp]
    );

    const lookupNow = useCallback(async () => {
        if (!latest.current.enabled || forcingRef.current) {
            return;
        }
        forcingRef.current = true;
        setForcing(true);
        clearTimers();
        forceRef.current = true;
        try {
            // `run` awaits the fast pass, so by here its outcome is recorded and
            // the follow-up can judge it without the idle timer's guesswork.
            await run();
            await runGroundedFollowUp();
        } finally {
            forcingRef.current = false;
            setForcing(false);
        }
    }, [clearTimers, run, runGroundedFollowUp]);

    const cancel = useCallback(() => {
        clearTimers();
        requestIdRef.current += 1;
        inFlightRef.current.clear();
    }, [clearTimers]);

    if (!enabled && pending) {
        setPending(false);
    }

    useEffect(() => {
        if (!enabled) {
            cancel();
        }
    }, [enabled, cancel]);

    useEffect(() => () => cancel(), [cancel]);

    /**
     * The currency is a locator the lookup was made with, so changing it after
     * the merchant resolved has to ask again: the same name in another
     * currency can be another business, and a logo the form already attached
     * would otherwise be saved with the row, where the backfill treats it as
     * final.
     */
    const seenCurrencyRef = useRef(currency);
    useEffect(() => {
        if (seenCurrencyRef.current === currency) {
            return;
        }
        seenCurrencyRef.current = currency;
        if (!latest.current.enabled) {
            return;
        }
        // Whatever is still out was asked with the old locator and must not
        // answer for the new one, cache included; nor may the last fast answer
        // stand in for the new currency's when the grounded timer fires.
        supersedeInFlight();
        lastRemoteOutcomeRef.current = null;
        const key = merchantKey(nameRef.current);
        if (key.length < MIN_KEY_LENGTH) {
            return;
        }
        // The logo on screen was found for the old currency. Only the domain is
        // withdrawn — the category and tags do not depend on where the purchase
        // was — so a save before the re-ask lands stores no wrong country's
        // brand, and the backfill can still reach the row.
        const last = lastEmittedRef.current;
        if (last != null && last.key === key && last.suggestion.domain != null) {
            emit({ ...last.suggestion, domain: null });
        }
        onNameChange(nameRef.current);
    }, [currency, emit, onNameChange, supersedeInFlight]);

    /**
     * The side of the ledger picks the category namespace the request was
     * built with, so a request still out for the other side must not answer:
     * its category would be filed on the wrong side. Asked again for the new
     * side, as a currency change is.
     */
    const seenIncomeRef = useRef(income);
    useEffect(() => {
        if (seenIncomeRef.current === income) {
            return;
        }
        seenIncomeRef.current = income;
        if (!latest.current.enabled) {
            return;
        }
        supersedeInFlight();
        lastRemoteOutcomeRef.current = null;
        if (merchantKey(nameRef.current).length < MIN_KEY_LENGTH) {
            return;
        }
        onNameChange(nameRef.current);
    }, [income, onNameChange, supersedeInFlight]);

    return { lookupNow, onNameChange, pending: pending || forcing };
}
