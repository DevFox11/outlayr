import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { categoryKey } from "@/data/transfer-core";
import type { ParsedImportFile } from "@/data/transfer-core";
import * as enrichmentCache from "@/domain/enrichment-cache";
import type { UnavailableReason } from "@/domain/import-flow";
import type { MappingDraft } from "@/domain/import-mapping";
import { reviewEntryIdentity } from "@/domain/import-review-identity";
import * as merchantResolver from "@/domain/merchant-resolver";
import type { CsvImportFn, CsvImportRequest, CsvImportResult, CsvImportStatus } from "@/lib/convex";

import { AI_TIER_MAX_CHARS, AI_TIER_MAX_ROWS, useCsvImport } from "./use-csv-import";
import type { UseCsvImportArgs } from "./use-csv-import";

const PARSED: ParsedImportFile = {
    header: ["date", "description", "amount"],
    rows: [],
    width: 3,
};

const DRAFT: MappingDraft = {
    amount: 2,
    category: 1,
    currency: null,
    date: 0,
    exchangeRate: null,
    exchangeRateType: null,
    note: 1,
    type: null,
};

const UNKNOWN = "zzq unresolvable merchant alpha";
const OTHER_UNKNOWN = "zzq unresolvable merchant beta";

function baseArgs(overrides: Partial<UseCsvImportArgs> = {}): UseCsvImportArgs {
    return {
        aiEnrichment: true,
        categoryIdByKey: new Map(),
        categoryTree: [],
        chars: 100,
        draft: DRAFT,
        fileKey: "test-file",
        groundedLookup: true,
        labels: [],
        parsed: PARSED,
        regionCode: undefined,
        transport: null,
        ...overrides,
    };
}

interface DeferredCall {
    reject: (error: unknown) => void;
    settle: (value: CsvImportResult) => void;
}

function deferredTransport(): {
    fn: CsvImportFn & jest.Mock;
    calls: DeferredCall[];
} {
    const calls: DeferredCall[] = [];
    const fn = jest.fn(
        () =>
            new Promise<CsvImportResult>((resolve, reject) => {
                calls.push({ reject, settle: resolve });
            })
    ) as CsvImportFn & jest.Mock;
    return { calls, fn };
}

beforeEach(() => {
    enrichmentCache.clearEnrichmentCache();
});

describe("tier 1 resolves before any transport call", () => {
    it("settles applied with zero network calls when the merchant map resolves everything", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    labels: ["netflix"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("applied");
        expect(result.current.reason).toBeNull();
        expect(result.current.links.get("netflix")).toBe("cat-entertainment");
        expect(result.current.tier1Matched).toBe(1);
    });
});

describe("tier 2: exactly one call per import", () => {
    it("calls the transport exactly once for several unresolved labels", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    labels: [UNKNOWN, OTHER_UNKNOWN, `${UNKNOWN} again`],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });
        expect(fn).toHaveBeenCalledTimes(1);

        await act(async () => {
            calls[0].settle({ status: "ok", suggestions: [] });
        });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(result.current.outcome).toBe("applied");
    });

    it("ignores a second run() call while one is already in flight", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        await act(async () => {
            result.current.run();
            result.current.run();
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe("stage: the progress the resolve step can actually show", () => {
    it("starts idle before anything runs", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        expect(result.current.stage).toBe("idle");
    });

    it("reports asking only while the model call is in flight, then settles", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        await act(async () => {
            result.current.run();
        });
        expect(result.current.stage).toBe("asking");

        await act(async () => {
            calls[0].settle({ status: "ok", suggestions: [] });
        });
        expect(result.current.stage).toBe("settled");
    });

    it("settles without ever asking when every label matches on device", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    labels: ["netflix"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.stage).toBe("settled");
        expect(result.current.tier2Sent).toBe(0);
    });

    it("settles when the call fails, so the list never hangs mid-stage", async () => {
        const fn: CsvImportFn = jest.fn(() => Promise.reject(new Error("offline")));
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.stage).toBe("settled");
    });

    it("returns to idle when a different file is selected", async () => {
        const { fn, calls } = deferredTransport();
        const { result, rerender } = await renderHook((args: UseCsvImportArgs) => useCsvImport(args), {
            initialProps: baseArgs({ labels: [UNKNOWN], transport: fn }),
        });

        await act(async () => {
            result.current.run();
        });
        await act(async () => {
            calls[0].settle({ status: "ok", suggestions: [] });
        });
        expect(result.current.stage).toBe("settled");

        await act(async () => {
            rerender(baseArgs({ fileKey: "other.csv:99", labels: [UNKNOWN], transport: fn }));
        });

        expect(result.current.stage).toBe("idle");
    });
});

describe("server-side learning for merchants the map cannot fully answer", () => {
    it("forwards the grounded consent flag and region code to the transport", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    groundedLookup: true,
                    labels: [UNKNOWN],
                    regionCode: "VE",
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ groundedLookup: true, regionCode: "VE" }));
    });

    it("sends a map match that has no domain to the transport so its domain can be learned", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([[categoryKey("Phone & Internet"), "cat-phone"]]),
                    labels: ["cantv"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ labels: ["cantv"] }));

        await act(async () => {
            calls[0].settle({
                status: "ok",
                suggestions: [
                    {
                        categoryName: "Phone & Internet",
                        domain: "cantv.com.ve",
                        label: "cantv",
                    },
                ],
            });
        });

        expect(result.current.links.get(categoryKey("cantv"))).toBe("cat-phone");
        expect(reviewEntryIdentity("cantv").domain).toBe("cantv.com.ve");
    });

    it("sends the reported regional spellings to the transport for server-side resolution", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([[categoryKey("Groceries"), "cat-groc"]]),
                    labels: ["Corpoelec", "Automercado Plaza's"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).toHaveBeenCalledWith(
            expect.objectContaining({
                labels: expect.arrayContaining(["Corpoelec", "Automercado Plaza's"]),
            })
        );
    });

    it("keeps a fully-resolved map match with a domain out of the transport labels", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    labels: ["netflix"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("applied");
    });
});

describe("suggestion domains seed the enrichment cache", () => {
    it("a suggestion carrying a domain makes review identity resolve that domain", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([[categoryKey("Healthcare"), "cat-health"]]),
                    labels: ["FARMACIA SAAS 00012345"],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });
        await act(async () => {
            calls[0].settle({
                status: "ok",
                suggestions: [
                    {
                        categoryName: "Healthcare",
                        domain: "farmaciasaas.com",
                        label: "FARMACIA SAAS",
                    },
                ],
            });
        });

        expect(result.current.links.get(categoryKey("FARMACIA SAAS 00012345"))).toBe("cat-health");
        expect(reviewEntryIdentity("FARMACIA SAAS 00012345").domain).toBe("farmaciasaas.com");
    });

    it("seeds the domain even when the suggested category is not in the tree", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(baseArgs({ labels: ["FARMACIA SAAS 00012345"], transport: fn }))
        );

        await act(async () => {
            result.current.run();
        });
        await act(async () => {
            calls[0].settle({
                status: "ok",
                suggestions: [
                    {
                        categoryName: "Healthcare",
                        domain: "farmaciasaas.com",
                        label: "FARMACIA SAAS",
                    },
                ],
            });
        });

        expect(result.current.links.size).toBe(0);
        expect(reviewEntryIdentity("FARMACIA SAAS 00012345").domain).toBe("farmaciasaas.com");
    });
});

describe("aiEnrichment setting off", () => {
    it("never calls the transport and settles declined", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(baseArgs({ aiEnrichment: false, labels: [UNKNOWN], transport: fn }))
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("declined");
        expect(result.current.reason).toBeNull();
    });
});

describe("over cap — the AI tier is gated, not the import", () => {
    it("skips the transport when characters exceed the AI tier cap, but a plan still reaches review", async () => {
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    chars: AI_TIER_MAX_CHARS + 1,
                    labels: ["netflix", UNKNOWN],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.reason).toBe("overCap");
        expect(result.current.links.size).toBeGreaterThan(0);
        expect(result.current.links.get("netflix")).toBe("cat-entertainment");
    });

    it("skips the transport when the parsed row count exceeds the AI tier cap, but a plan still reaches review", async () => {
        const { fn } = deferredTransport();
        const manyRows = Array.from({ length: AI_TIER_MAX_ROWS + 1 }, () => ["01/08/2026", "x", "1,00"]);
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    labels: ["netflix", UNKNOWN],
                    parsed: { ...PARSED, rows: manyRows },
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.reason).toBe("overCap");
        expect(result.current.links.size).toBeGreaterThan(0);
        expect(result.current.links.get("netflix")).toBe("cat-entertainment");
    });
});

describe("transport failure never throws", () => {
    it("a rejecting transport settles unavailable with reason offline", async () => {
        const fn: CsvImportFn = jest.fn(() => Promise.reject(new Error("network down")));
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.reason).toBe("offline");
    });

    it("has not resolved just before 15000ms and has resolved just after", async () => {
        jest.useFakeTimers();
        const { fn } = deferredTransport();
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

        await act(async () => {
            result.current.run();
        });
        expect(result.current.running).toBe(true);

        await act(async () => {
            jest.advanceTimersByTime(14_999);
        });
        expect(result.current.running).toBe(true);
        expect(result.current.outcome).toBeNull();

        await act(async () => {
            jest.advanceTimersByTime(2);
        });
        expect(result.current.running).toBe(false);
        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.reason).toBe("timeout");
        jest.useRealTimers();
    });
});

describe("each server status maps to its own reason", () => {
    const cases: [CsvImportStatus, UnavailableReason][] = [
        ["notConfigured", "notConfigured"],
        ["rateLimited", "rateLimited"],
        ["invalidResponse", "invalidResponse"],
        ["providerError", "providerError"],
        ["invalid", "providerError"],
        ["unauthenticated", "unauthenticated"],
    ];

    for (const [status, reason] of cases) {
        it(`maps "${status}" to "${reason}"`, async () => {
            const fn: CsvImportFn = jest.fn(() => Promise.resolve({ status, suggestions: null }));
            const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: fn })));

            await act(async () => {
                result.current.run();
            });

            expect(result.current.outcome).toBe("unavailable");
            expect(result.current.reason).toBe(reason);
        });
    }
});

describe("enrichment-cache boundary (A10)", () => {
    it("never writes to the enrichment cache, even after a successful model response", async () => {
        const setSpy = jest.spyOn(enrichmentCache, "setCachedEnrichment");
        const fn: CsvImportFn = jest.fn(() =>
            Promise.resolve({
                status: "ok" as const,
                suggestions: [{ categoryName: "Food", label: UNKNOWN }],
            })
        );
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["food", "cat-food"]]),
                    labels: [UNKNOWN],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("applied");
        expect(result.current.links.get(UNKNOWN)).toBe("cat-food");
        expect(setSpy).not.toHaveBeenCalled();
    });

    it("reuses a cache entry left by the single-transaction enrichment flow, skipping the transport for that label", async () => {
        enrichmentCache.setCachedEnrichment(merchantResolver.merchantKey(UNKNOWN), {
            categoryName: "Food",
            domain: null,
            isNewCategory: false,
            tags: [],
        });
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["food", "cat-food"]]),
                    labels: [UNKNOWN],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("applied");
        expect(result.current.links.get(UNKNOWN)).toBe("cat-food");
    });

    it("reuses a cache entry keyed by the clean name for a label carrying a store number", async () => {
        enrichmentCache.setCachedEnrichment(merchantResolver.merchantKey(UNKNOWN), {
            categoryName: "Food",
            domain: null,
            isNewCategory: false,
            tags: [],
        });
        const raw = `${UNKNOWN} 1234567`;
        const { fn } = deferredTransport();
        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["food", "cat-food"]]),
                    labels: [raw],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(fn).not.toHaveBeenCalled();
        expect(result.current.outcome).toBe("applied");
        expect(result.current.links.get(categoryKey(raw))).toBe("cat-food");
    });
});

describe("raw ↔ scrubbed label correspondence", () => {
    it("resolves the link by the RAW label's key, not the scrubbed label the payload sends", async () => {
        const raw = `${UNKNOWN} 1234567`;
        const fn = jest.fn((payload: CsvImportRequest) => {
            expect(payload.labels).toStrictEqual([UNKNOWN]);
            return Promise.resolve({
                status: "ok" as const,
                suggestions: [{ categoryName: "Shopping", label: UNKNOWN }],
            });
        }) as CsvImportFn & jest.Mock;

        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["shopping", "cat-shopping"]]),
                    labels: [raw],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("applied");
        expect(result.current.links.get(categoryKey(raw))).toBe("cat-shopping");
    });
});

describe("no backend configured", () => {
    it("settles unavailable/notConfigured (non-retryable) rather than calling nothing silently", async () => {
        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN], transport: null })));

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.reason).toBe("notConfigured");
    });
});

describe("changing the selected file resets a settled resolution", () => {
    it("clears outcome, links, and counters so the CTA returns", async () => {
        const { fn } = deferredTransport();
        const { result, rerender } = await renderHook((props: UseCsvImportArgs) => useCsvImport(props), {
            initialProps: baseArgs({
                categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                fileKey: "file-a",
                labels: ["netflix"],
                transport: fn,
            }),
        });

        await act(async () => {
            result.current.run();
        });

        expect(result.current.outcome).toBe("applied");
        expect(result.current.tier1Matched).toBe(1);
        expect(result.current.links.size).toBe(1);

        await rerender(baseArgs({ fileKey: "file-b", labels: [UNKNOWN], transport: fn }));

        expect(result.current.outcome).toBeNull();
        expect(result.current.tier1Matched).toBe(0);
        expect(result.current.tier2Sent).toBe(0);
        expect(result.current.links.size).toBe(0);
        expect(result.current.running).toBe(false);
    });
});

describe("resuming with the same file after a remount stays idle (design §2.3.2 regression guard)", () => {
    it("never auto-runs on a fresh mount whose fileKey matches a prior, already-settled session", async () => {
        const { fn } = deferredTransport();
        const args = baseArgs({
            categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
            fileKey: "resumed-file",
            labels: ["netflix"],
            transport: fn,
        });

        const first = await renderHook(() => useCsvImport(args));
        await act(async () => {
            first.result.current.run();
        });
        expect(first.result.current.outcome).toBe("applied");
        await first.unmount();

        const second = await renderHook(() => useCsvImport(args));

        expect(second.result.current.running).toBe(false);
        expect(second.result.current.outcome).toBeNull();
        expect(fn).not.toHaveBeenCalled();
    });
});

describe("any throw during the run settles unavailable instead of rejecting", () => {
    it("recovers when on-device resolution throws", async () => {
        const spy = jest.spyOn(merchantResolver, "resolveMerchant").mockImplementation(() => {
            throw new Error("boom");
        });

        const { result } = await renderHook(() => useCsvImport(baseArgs({ labels: [UNKNOWN] })));

        await act(async () => {
            result.current.run();
        });

        expect(result.current.running).toBe(false);
        expect(result.current.outcome).toBe("unavailable");
        spy.mockRestore();
    });

    it("keeps on-device links and matching counters when a throw follows the tier-1 pass", async () => {
        const spy = jest.spyOn(enrichmentCache, "getCachedEnrichment").mockImplementation(() => {
            throw new Error("boom");
        });

        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: new Map([["entertainment", "cat-entertainment"]]),
                    labels: ["netflix", UNKNOWN],
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(result.current.running).toBe(false);
        expect(result.current.outcome).toBe("unavailable");
        expect(result.current.tier1Matched).toBe(1);
        expect(result.current.links.size).toBe(result.current.tier1Matched);
        expect(result.current.links.get("netflix")).toBe("cat-entertainment");
        spy.mockRestore();
    });

    it("recovers when suggestion post-processing throws", async () => {
        const throwingCategoryIdByKey = {
            get(key: string) {
                if (key === categoryKey("boom")) {
                    throw new Error("boom");
                }
            },
        } as unknown as ReadonlyMap<string, string>;
        const fn: CsvImportFn = jest.fn(() =>
            Promise.resolve({
                status: "ok" as const,
                suggestions: [{ categoryName: "boom", label: UNKNOWN }],
            })
        );

        const { result } = await renderHook(() =>
            useCsvImport(
                baseArgs({
                    categoryIdByKey: throwingCategoryIdByKey,
                    labels: [UNKNOWN],
                    transport: fn,
                })
            )
        );

        await act(async () => {
            result.current.run();
        });

        expect(result.current.running).toBe(false);
        expect(result.current.outcome).toBe("unavailable");
    });
});
