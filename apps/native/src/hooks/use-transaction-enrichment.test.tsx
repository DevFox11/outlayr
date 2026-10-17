import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { clearEnrichmentCache, getCachedEnrichment, setCachedEnrichment } from "@/domain/enrichment-cache";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";
import { merchantKey } from "@/domain/merchant-resolver";
import { setRuntimeLanguage } from "@/i18n/runtime";
import type { EnrichmentFn, EnrichmentRequest } from "@/lib/convex";

import { REMOTE_TIMEOUT_MS, useTransactionEnrichment } from "./use-transaction-enrichment";
import type { EnrichmentSuggestion, UseTransactionEnrichmentArgs } from "./use-transaction-enrichment";

const DEBOUNCE_MS = 600;
const GROUNDED_IDLE_MS = 1800;
const UNKNOWN = "zzq unresolvable merchant alpha";
const OTHER_UNKNOWN = "zzq unresolvable merchant beta";

/**
 * `transport: null` by default — the real one resolves a Convex client, and a
 * test that forgot to inject would otherwise reach for the network.
 */
function baseArgs(overrides: Partial<UseTransactionEnrichmentArgs> = {}): UseTransactionEnrichmentArgs {
    return {
        categoryTree: [],
        enabled: true,
        income: false,
        onSuggest: () => {},
        resolveLocal: (suggestion) => suggestion,
        transport: null,
        ...overrides,
    };
}

interface DeferredCall {
    args: EnrichmentRequest;
    settle: (value: RemoteEnrichmentResult | null) => void;
}

function deferredTransport(): {
    fn: jest.Mock<EnrichmentFn>;
    calls: DeferredCall[];
} {
    const calls: DeferredCall[] = [];
    const fn = jest.fn(
        (args: EnrichmentRequest) =>
            new Promise<RemoteEnrichmentResult>((resolve) => {
                calls.push({
                    args,
                    settle: (value) => resolve(value as RemoteEnrichmentResult),
                });
            })
    );
    return { calls, fn };
}

const REMOTE_RESULT: RemoteEnrichmentResult = {
    categoryName: "Entertainment",
    domain: "example.com",
    isNewCategory: false,
    tags: ["Streaming"],
};

beforeEach(() => {
    jest.useFakeTimers();
    clearEnrichmentCache();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("tier 1: curated match", () => {
    it("emits a curated suggestion synchronously with zero pending flags", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest })));

        result.current.onNameChange("netflix");
        jest.advanceTimersByTime(DEBOUNCE_MS);

        expect(onSuggest).toHaveBeenCalledTimes(1);
        const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
        expect(suggestion.source).toBe("curated");
        expect(suggestion.domain).toBe("netflix.com");
        expect(suggestion.pendingTagNames).toStrictEqual(["Streaming", "Subscription"]);
        // The Entertainment preset's own identity, stated rather than read from
        // `SUGGESTED_CATEGORY_PRESETS` — reading it would let a lookup that
        // resolved the wrong preset still agree with itself.
        expect(suggestion.pendingCategory).toStrictEqual({
            color: "#936EAF",
            emoji: null,
            icon: "FilmRoll01",
            name: "Entertainment",
            parentName: null,
        });
        expect(result.current.pending).toBe(false);
    });

    it("names curated tags in the app's language", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest })));
        setRuntimeLanguage("es");
        try {
            result.current.onNameChange("costco");
            jest.advanceTimersByTime(DEBOUNCE_MS);
        } finally {
            setRuntimeLanguage("en");
        }

        const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
        expect(suggestion.pendingTagNames).toStrictEqual(["Mayorista"]);
    });

    it("reports an empty suggestion below the 3-character floor so stale fields clear", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest })));

        result.current.onNameChange("netflix");
        jest.advanceTimersByTime(DEBOUNCE_MS);
        expect(onSuggest).toHaveBeenLastCalledWith(expect.objectContaining({ domain: "netflix.com" }));

        // Silence here would leave Netflix's category and logo on an entry that
        // is no longer Netflix.
        result.current.onNameChange("hi");
        jest.advanceTimersByTime(DEBOUNCE_MS);
        expect(onSuggest).toHaveBeenLastCalledWith({
            categoryId: null,
            domain: null,
            pendingCategory: null,
            pendingTagNames: [],
            source: "curated",
            tagIds: [],
        });
    });

    it("passes the raw curated candidate through resolveLocal before emitting", async () => {
        const resolveLocal = jest.fn((suggestion: EnrichmentSuggestion): EnrichmentSuggestion => ({
            ...suggestion,
            categoryId: "resolved-category-id",
            pendingCategory: null,
        }));
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, resolveLocal })));

        result.current.onNameChange("netflix");
        jest.advanceTimersByTime(DEBOUNCE_MS);

        expect(resolveLocal).toHaveBeenCalledTimes(1);
        expect(onSuggest).toHaveBeenCalledWith(
            expect.objectContaining({
                categoryId: "resolved-category-id",
                pendingCategory: null,
            })
        );
    });
});

describe("tier 1.5: domain-less curated fallthrough", () => {
    it("emits the curated category and tags at once for a domain-less curated hit", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: null })));

        result.current.onNameChange("cantv");
        jest.advanceTimersByTime(DEBOUNCE_MS);

        expect(onSuggest).toHaveBeenCalledTimes(1);
        const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
        expect(suggestion.source).toBe("curated");
        expect(suggestion.domain).toBeNull();
        expect(suggestion.pendingTagNames).toStrictEqual(["Phone", "Internet"]);
    });

    it("issues exactly one transport call and merges only the remote domain onto the curated result", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(onSuggest).toHaveBeenCalledTimes(1);

        await act(async () => {
            calls[0].settle({
                categoryName: "Something Else",
                domain: "cantv.com.ve",
                isNewCategory: false,
                tags: ["Wrong"],
            });
        });

        expect(onSuggest).toHaveBeenCalledTimes(2);
        const merged = onSuggest.mock.calls[1][0] as EnrichmentSuggestion;
        expect(merged.domain).toBe("cantv.com.ve");
        expect(merged.pendingCategory?.name).toBe("Phone & Internet");
        expect(merged.pendingTagNames).toStrictEqual(["Phone", "Internet"]);
    });

    it("leaves the curated category and tags intact when the remote result is stale or fails", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(onSuggest).toHaveBeenCalledTimes(1);

        await act(async () => {
            jest.advanceTimersByTime(REMOTE_TIMEOUT_MS + 1);
        });
        calls[0].settle(null);

        expect(onSuggest).toHaveBeenCalledTimes(1);
        const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
        expect(suggestion.pendingCategory?.name).toBe("Phone & Internet");
        expect(suggestion.pendingTagNames).toStrictEqual(["Phone", "Internet"]);
        expect(suggestion.domain).toBeNull();
    });

    it("makes no call and keeps no domain when remote is disabled", async () => {
        const { fn } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ onSuggest, remoteEnabled: false, transport: fn }))
        );

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).not.toHaveBeenCalled();
        expect(onSuggest).toHaveBeenCalledTimes(1);
        const suggestion = onSuggest.mock.calls[0][0] as EnrichmentSuggestion;
        expect(suggestion.domain).toBeNull();
        expect(suggestion.pendingCategory?.name).toBe("Phone & Internet");
    });

    it("reuses a cached remote domain to merge onto the curated result, with no new call", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: null,
                domain: "cantv.com.ve",
                isNewCategory: false,
                tags: [],
            });
        });
        expect(fn).toHaveBeenCalledTimes(1);

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(1);
        const last = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(last.domain).toBe("cantv.com.ve");
        expect(last.pendingCategory?.name).toBe("Phone & Internet");
    });
});

describe("tier 1.75: the caller's own on-device domain tier", () => {
    it("answers before the model and merges onto a domain-less curated hit", async () => {
        const { fn } = deferredTransport();
        const onSuggest = jest.fn<(suggestion: EnrichmentSuggestion) => void>();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(
                baseArgs({
                    onSuggest,
                    resolveDomain: (key) => (key === merchantKey(UNKNOWN) ? "example.com" : null),
                    transport: fn,
                })
            )
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS + GROUNDED_IDLE_MS);
        });

        expect(onSuggest).toHaveBeenLastCalledWith(expect.objectContaining({ domain: "example.com" }));
        expect(fn).not.toHaveBeenCalled();
    });
});

describe("tier 1.9: the merchant book this device already filled", () => {
    it("answers a remembered merchant without asking the backend", async () => {
        const onSuggest = jest.fn();
        const transport = deferredTransport();
        const recallMerchant = jest.fn<NonNullable<UseTransactionEnrichmentArgs["recallMerchant"]>>(
            async () => REMOTE_RESULT
        );
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ onSuggest, recallMerchant, transport: transport.fn }))
        );

        await act(async () => {
            result.current.onNameChange(UNKNOWN);
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(transport.fn).not.toHaveBeenCalled();
        expect(recallMerchant).toHaveBeenCalledWith(UNKNOWN, undefined);
        const suggestion = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(suggestion).toMatchObject({ domain: "example.com", source: "remote" });
    });

    it("sends nothing for a remembered merchant without a domain while remote lookups are off", async () => {
        const transport = deferredTransport();
        const recallMerchant = jest.fn<NonNullable<UseTransactionEnrichmentArgs["recallMerchant"]>>(async () => ({
            ...REMOTE_RESULT,
            domain: null,
        }));
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ recallMerchant, remoteEnabled: false, transport: transport.fn }))
        );

        await act(async () => {
            result.current.onNameChange(UNKNOWN);
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });

        expect(recallMerchant).toHaveBeenCalledWith(UNKNOWN, undefined);
        expect(transport.fn).not.toHaveBeenCalled();
    });

    it("still asks the backend for a merchant it has never seen", async () => {
        const transport = deferredTransport();
        const recallMerchant = jest.fn<NonNullable<UseTransactionEnrichmentArgs["recallMerchant"]>>(async () => null);
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ recallMerchant, transport: transport.fn }))
        );

        await act(async () => {
            result.current.onNameChange(UNKNOWN);
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(transport.fn).toHaveBeenCalledTimes(1);
    });
});

describe("tier 2: remote fallback", () => {
    it("never calls the transport when tier 1 already answered", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).not.toHaveBeenCalled();
    });

    it("issues exactly one call for 20 keystrokes of an unknown merchant", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        for (let index = 0; index < 20; index += 1) {
            result.current.onNameChange(UNKNOWN.slice(0, 10 + (index % 10)));
        }
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("sends only the merchant name, the user's own category names and the entry's currency code", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(
                baseArgs({
                    categoryTree: [{ children: [], name: "Groceries" }],
                    currency: "EUR",
                    transport: fn,
                })
            )
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(Object.keys(calls[0].args).sort()).toStrictEqual([
            "categoryTree",
            "currency",
            "groundedLookup",
            "income",
            "locale",
            "name",
            "regionCode",
        ]);
        expect(calls[0].args.currency).toBe("EUR");
    });

    it("asks again when the currency changes after the merchant resolved, withdrawing the old logo first", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn<(suggestion: EnrichmentSuggestion) => void>();
        const { result, rerender } = await renderHook(
            (props: { currency: string }) =>
                useTransactionEnrichment(baseArgs({ currency: props.currency, onSuggest, transport: fn })),
            { initialProps: { currency: "VES" } }
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({ categoryName: "Groceries", domain: "carrefour.com.ve", isNewCategory: false, tags: [] });
        });
        expect(calls).toHaveLength(1);

        await act(async () => {
            rerender({ currency: "EUR" });
        });
        expect(onSuggest).toHaveBeenLastCalledWith(expect.objectContaining({ domain: null, source: "remote" }));
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(calls).toHaveLength(2);
        expect(calls[1].args.currency).toBe("EUR");
    });

    it("threads regionCode into both the fast and grounded-follow-up calls", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ regionCode: "VE", transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: "Entertainment",
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });

        expect(calls[0].args.regionCode).toBe("VE");
        expect(calls[1].args.regionCode).toBe("VE");
    });

    it("still follows up when the fast pass answers after the idle tick", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS);
        });
        expect(calls).toHaveLength(1);

        await act(async () => {
            calls[0].settle({ categoryName: "Entertainment", domain: null, isNewCategory: false, tags: [] });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS);
        });

        expect(calls).toHaveLength(2);
        expect(calls[1].args.groundedLookup).toBe(true);
    });

    it("gives up on the follow-up once the fast pass answers with a domain", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS + GROUNDED_IDLE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: "Entertainment",
                domain: "example.com",
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS * 3);
        });

        expect(calls).toHaveLength(1);
    });

    it("typing then settling issues exactly one grounded-enabled follow-up call", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: "Entertainment",
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(2);
        expect(calls[0].args.groundedLookup).toBe(false);
        expect(calls[1].args.groundedLookup).toBe(true);
    });

    it("typing a prefix then continuing issues no grounded call for the abandoned prefix", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange("Rio");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            jest.advanceTimersByTime(1000);
        });
        result.current.onNameChange("Rio supermercado");
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS);
        });

        expect(calls.every((call) => call.args.groundedLookup === false)).toBe(true);
    });

    it("never issues a grounded-enabled follow-up when the setting is off", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ groundedLookup: false, transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(calls[0].args.groundedLookup).toBe(false);
        await act(async () => {
            calls[0].settle({
                categoryName: "Entertainment",
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("reuses a cached negative result rather than calling again", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle(null);
        });
        expect(fn).toHaveBeenCalledTimes(1);

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("lookupNow asks again past the session cache, for the name it opened with", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ initialName: UNKNOWN, onSuggest, transport: fn }))
        );
        setCachedEnrichment(merchantKey(UNKNOWN), null);

        let lookup: Promise<void> = Promise.resolve();
        await act(async () => {
            lookup = result.current.lookupNow();
        });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(calls[0].args.name).toBe(UNKNOWN);
        expect(result.current.pending).toBe(true);

        await act(async () => {
            calls[0].settle(REMOTE_RESULT);
            await lookup;
        });
        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ domain: "example.com", source: "remote" })
        );
        expect(result.current.pending).toBe(false);

        // The force is spent: the next debounced lookup of the same name is a
        // cache hit again, not a second call.
        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("lookupNow stays pending through the grounded follow-up, and ignores a second tap meanwhile", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ groundedLookup: true, initialName: UNKNOWN, transport: fn }))
        );

        let lookup: Promise<void> = Promise.resolve();
        await act(async () => {
            lookup = result.current.lookupNow();
        });
        await act(async () => {
            void result.current.lookupNow();
            calls[0].settle(null);
        });
        // The fast pass answered without a domain, so the grounded call is out
        // and the button must stay held.
        expect(calls).toHaveLength(2);
        expect(calls[1].args.groundedLookup).toBe(true);
        expect(result.current.pending).toBe(true);

        await act(async () => {
            calls[1].settle(REMOTE_RESULT);
            await lookup;
        });
        expect(result.current.pending).toBe(false);
    });

    it("keeps a result that settles after the field moved on out of the new name, and still caches it", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        // Typed on before the debounce for the new name has fired.
        result.current.onNameChange(OTHER_UNKNOWN);
        onSuggest.mockClear();
        await act(async () => {
            calls[0].settle(REMOTE_RESULT);
        });

        expect(onSuggest).not.toHaveBeenCalled();
        expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({ hit: true, value: REMOTE_RESULT });
    });

    it("drops a request built for the other side of the ledger when income flips, and asks again", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { rerender, result } = await renderHook(
            ({ income }: { income: boolean }) =>
                useTransactionEnrichment(baseArgs({ income, onSuggest, transport: fn })),
            { initialProps: { income: false } }
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(calls[0].args.income).toBe(false);

        await rerender({ income: true });
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(calls).toHaveLength(2);
        expect(calls[1].args.income).toBe(true);

        onSuggest.mockClear();
        await act(async () => {
            calls[0].settle(REMOTE_RESULT);
        });
        expect(onSuggest).not.toHaveBeenCalled();
    });

    it("drops a stale result once a newer request supersedes it", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        result.current.onNameChange(OTHER_UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(calls).toHaveLength(2);

        await act(async () => {
            calls[0].settle(REMOTE_RESULT);
        });

        expect(onSuggest).not.toHaveBeenCalled();
        expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({
            hit: false,
        });
    });

    it("makes no call when the setting is off, and tier 1 still resolves", async () => {
        const { fn } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ onSuggest, remoteEnabled: false, transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).not.toHaveBeenCalled();

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        // Twice: the empty report for the unresolvable name, then the curated hit.
        expect(onSuggest).toHaveBeenCalledTimes(2);
        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ domain: "netflix.com", source: "curated" })
        );
        expect(fn).not.toHaveBeenCalled();
    });

    it("makes no call and raises nothing when there is no backend", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: null })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(onSuggest).not.toHaveBeenCalled();
        expect(result.current.pending).toBe(false);
    });

    it("does not cache a grounding-pending result, so a repeat lookup tries again", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: null,
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });

        expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({
            hit: false,
        });

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("gives up at the abort budget and caches the miss", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(result.current.pending).toBe(true);

        await act(async () => {
            jest.advanceTimersByTime(REMOTE_TIMEOUT_MS + 1);
        });

        expect(result.current.pending).toBe(false);
        expect(getCachedEnrichment(merchantKey(UNKNOWN))).toStrictEqual({
            hit: true,
            value: null,
        });
    });
});

describe("grounded re-check: the open form receives the domain", () => {
    const GROUNDED_RECHECK_MS = 8000;
    const GROUNDED_RECHECK_RETRY_MS = 12_000;

    async function reachFollowUp(overrides: Partial<UseTransactionEnrichmentArgs>) {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result, unmount } = await renderHook(() =>
            useTransactionEnrichment(baseArgs({ onSuggest, transport: fn, ...overrides }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: "Entertainment",
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });
        return { calls, fn, onSuggest, result, unmount };
    }

    it("merges a domain the follow-up itself answers with, without any re-check", async () => {
        const { fn, calls, onSuggest } = await reachFollowUp({});

        await act(async () => {
            calls[1].settle(REMOTE_RESULT);
        });

        const last = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(last.domain).toBe("example.com");

        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("schedules one re-check after a grounding-pending follow-up and emits the re-checked domain", async () => {
        const { fn, calls, onSuggest } = await reachFollowUp({});

        await act(async () => {
            calls[1].settle({
                categoryName: "Entertainment",
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });
        expect(fn).toHaveBeenCalledTimes(2);

        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });
        expect(fn).toHaveBeenCalledTimes(3);
        expect(calls[2].args.groundedLookup).toBe(false);
        expect(calls[2].args.knowledgeOnly).toBe(true);

        await act(async () => {
            calls[2].settle(REMOTE_RESULT);
        });
        const last = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(last.domain).toBe("example.com");
    });

    it("a re-check without a domain stays silent rather than wiping the shown category", async () => {
        const { calls, onSuggest } = await reachFollowUp({});

        await act(async () => {
            calls[1].settle({
                categoryName: "Entertainment",
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });
        const emitted = onSuggest.mock.calls.length;

        await act(async () => {
            calls[2].settle({
                categoryName: null,
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        expect(onSuggest).toHaveBeenCalledTimes(emitted);
    });

    it("retries the re-check once for a slow grounded search, then gives up for good", async () => {
        const { fn, calls, onSuggest } = await reachFollowUp({});

        await act(async () => {
            calls[1].settle({
                categoryName: "Entertainment",
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });
        await act(async () => {
            calls[2].settle({
                categoryName: null,
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });

        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_RETRY_MS);
        });
        expect(fn).toHaveBeenCalledTimes(4);
        await act(async () => {
            calls[3].settle(REMOTE_RESULT);
        });
        const last = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(last.domain).toBe("example.com");

        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_RETRY_MS * 4);
        });
        expect(fn).toHaveBeenCalledTimes(4);
    });

    it("merges the re-checked domain onto a domain-less curated hit, keeping curated category and tags", async () => {
        const { fn, calls } = deferredTransport();
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, transport: fn })));

        result.current.onNameChange("cantv");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle({
                categoryName: null,
                domain: null,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });
        await act(async () => {
            calls[1].settle({
                categoryName: null,
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });
        await act(async () => {
            calls[2].settle({
                categoryName: "Something Else",
                domain: "cantv.com.ve",
                isNewCategory: false,
                tags: ["Wrong"],
            });
        });

        const last = onSuggest.mock.calls.at(-1)?.[0] as EnrichmentSuggestion;
        expect(last.domain).toBe("cantv.com.ve");
        expect(last.pendingCategory?.name).toBe("Phone & Internet");
        expect(last.pendingTagNames).toStrictEqual(["Phone", "Internet"]);
    });

    it("a follow-up that settles after unmount emits nothing", async () => {
        const { fn, calls, onSuggest, unmount } = await reachFollowUp({});
        const emitted = onSuggest.mock.calls.length;

        await unmount();
        await act(async () => {
            calls[1].settle(REMOTE_RESULT);
        });

        expect(onSuggest).toHaveBeenCalledTimes(emitted);
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS + GROUNDED_RECHECK_RETRY_MS);
        });
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("typing a different name cancels the pending re-check", async () => {
        const { fn, calls, result } = await reachFollowUp({});

        await act(async () => {
            calls[1].settle({
                categoryName: "Entertainment",
                domain: null,
                grounding: true,
                isNewCategory: false,
                tags: [],
            });
        });
        result.current.onNameChange(OTHER_UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_RECHECK_MS);
        });

        expect(fn.mock.calls.filter((call: [EnrichmentRequest]) => call[0].name === UNKNOWN)).toHaveLength(2);
    });
});

describe("unmount and disable", () => {
    it("clears the pending timer on unmount so a settling debounce never fires", async () => {
        const onSuggest = jest.fn();
        const { result, unmount } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest })));

        result.current.onNameChange("netflix");
        await unmount();
        jest.advanceTimersByTime(DEBOUNCE_MS);

        expect(onSuggest).not.toHaveBeenCalled();
    });

    it("unmount cancels both the fast and grounded-follow-up timers", async () => {
        const { fn } = deferredTransport();
        const { result, unmount } = await renderHook(() => useTransactionEnrichment(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await unmount();
        jest.advanceTimersByTime(GROUNDED_IDLE_MS + 1);

        expect(fn).not.toHaveBeenCalled();
    });

    it("is fully inert when disabled: no timer, no suggestion, constant pending flags", async () => {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ enabled: false, onSuggest })));

        result.current.onNameChange("netflix");
        jest.advanceTimersByTime(DEBOUNCE_MS);

        expect(onSuggest).not.toHaveBeenCalled();
        expect(result.current.pending).toBe(false);
    });
});

describe("the ledger as a source", () => {
    async function typeName(name: string, overrides: Partial<UseTransactionEnrichmentArgs>) {
        const onSuggest = jest.fn();
        const { result } = await renderHook(() => useTransactionEnrichment(baseArgs({ onSuggest, ...overrides })));
        result.current.onNameChange(name);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        // The ledger lookup is awaited before anything is emitted, so the debounce
        // firing is not on its own enough to have produced a suggestion.
        await act(async () => {
            await Promise.resolve();
        });
        return onSuggest;
    }

    it("answers with the remembered category for a merchant no list and no model knows", async () => {
        const onSuggest = await typeName(UNKNOWN, { resolveHistory: async () => "cat-remembered" });

        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ categoryId: "cat-remembered", source: "history" })
        );
    });

    it("overrides the curated map, because the user's own filing outranks it", async () => {
        // Netflix is in the curated map as Entertainment; this user files it elsewhere.
        const onSuggest = await typeName("Netflix", { resolveHistory: async () => "cat-subscriptions" });

        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ categoryId: "cat-subscriptions", source: "history" })
        );
    });

    it("keeps the curated logo while overriding the curated category", async () => {
        const onSuggest = await typeName("Netflix", { resolveHistory: async () => "cat-subscriptions" });

        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ categoryId: "cat-subscriptions", domain: "netflix.com" })
        );
    });

    it("drops the pending category, so a remembered id is never shadowed by a name", async () => {
        const onSuggest = await typeName("Netflix", { resolveHistory: async () => "cat-subscriptions" });

        expect(onSuggest).toHaveBeenLastCalledWith(expect.objectContaining({ pendingCategory: null }));
    });

    it("leaves the curated answer alone when the ledger has never seen the merchant", async () => {
        const onSuggest = await typeName("Netflix", { resolveHistory: async () => null });

        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ domain: "netflix.com", source: "curated" })
        );
    });

    it("asks the ledger about the side of the book the entry is on", async () => {
        const resolveHistory = jest.fn<NonNullable<UseTransactionEnrichmentArgs["resolveHistory"]>>(async () => null);
        await typeName(UNKNOWN, { income: true, resolveHistory });

        expect(resolveHistory).toHaveBeenCalledWith(merchantKey(UNKNOWN), true);
    });

    it("answers from the ledger with the remote tier switched off", async () => {
        // `aiEnrichment` off keeps every lookup on-device; the user's own history
        // is on-device, so it is exactly what should still answer.
        const onSuggest = await typeName(UNKNOWN, {
            remoteEnabled: false,
            resolveHistory: async () => "cat-remembered",
        });

        expect(onSuggest).toHaveBeenLastCalledWith(
            expect.objectContaining({ categoryId: "cat-remembered", source: "history" })
        );
    });
});
