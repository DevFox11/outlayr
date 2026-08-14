import { act, renderHook } from "@testing-library/react-native";

import { clearEnrichmentCache } from "@/domain/enrichment-cache";
import type { RemoteEnrichmentResult } from "@/domain/enrichment-cache";
import type { EnrichmentFn, EnrichmentRequest } from "@/lib/convex";
import type { LogoOutcome } from "@/lib/logo-fetch";

import { useAccountIdentity } from "./use-account-identity";
import type { AccountLogo, UseAccountIdentityArgs } from "./use-account-identity";

const DEBOUNCE_MS = 600;
const GROUNDED_IDLE_MS = 1800;
const RECHECK_MS = 8000;
const UNKNOWN = "zzq unresolvable bank alpha";

const LOGO_BYTES = new Uint8Array([1, 2, 3]);
const LOGO: LogoOutcome = { bytes: LOGO_BYTES, kind: "logo" };
const NO_LOGO: LogoOutcome = { kind: "none" };
const PERSISTED: AccountLogo = {
    imageColor: "#0A5FFF",
    imageUri: "file:///logos/chase.png",
};

interface DeferredCall {
    args: EnrichmentRequest;
    settle: (value: RemoteEnrichmentResult | null) => void;
}

function deferredTransport(): {
    fn: EnrichmentFn & jest.Mock;
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
    ) as EnrichmentFn & jest.Mock;
    return { calls, fn };
}

function baseArgs(overrides: Partial<UseAccountIdentityArgs> = {}): UseAccountIdentityArgs {
    return {
        enabled: true,
        fetchImage: jest.fn(async () => LOGO),
        onClear: () => {},
        onLogo: () => {},
        persistLogo: jest.fn(async () => PERSISTED),
        transport: null,
        ...overrides,
    };
}

function domainResult(domain: string | null): RemoteEnrichmentResult {
    return {
        categoryName: "Finance",
        domain,
        isNewCategory: false,
        tags: ["Bank"],
    };
}

beforeEach(() => {
    jest.useFakeTimers();
    clearEnrichmentCache();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("debounce and domain consumption", () => {
    it("waits the 600ms debounce, then attaches the resolved logo", async () => {
        const { fn, calls } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo, transport: fn })));

        result.current.onNameChange(UNKNOWN);
        jest.advanceTimersByTime(DEBOUNCE_MS - 1);
        expect(fn).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(1);
        });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0].groundedLookup).toBe(false);

        await act(async () => {
            calls[0].settle(domainResult("chase.com"));
        });
        expect(fetchImage).toHaveBeenCalledWith({
            domain: "chase.com",
            name: UNKNOWN,
        });
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
    });

    it("resolves a curated merchant's domain with no transport at all", async () => {
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo })));

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fetchImage).toHaveBeenCalledWith({
            domain: "netflix.com",
            name: "netflix",
        });
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
    });

    it("clears instead of fetching when the name resolves to no domain", async () => {
        const { fn, calls } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onClear = jest.fn();
        const onLogo = jest.fn();
        const { result } = await renderHook(() =>
            useAccountIdentity(baseArgs({ fetchImage, onClear, onLogo, transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle(domainResult(null));
        });

        expect(fetchImage).not.toHaveBeenCalled();
        expect(onLogo).not.toHaveBeenCalled();
        expect(onClear).toHaveBeenCalled();
    });
});

describe("consent gates", () => {
    it("never calls the transport when aiEnrichment is off", async () => {
        const { fn } = deferredTransport();
        const onClear = jest.fn();
        const { result } = await renderHook(() =>
            useAccountIdentity(baseArgs({ onClear, remoteEnabled: false, transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS + GROUNDED_IDLE_MS);
        });

        expect(fn).not.toHaveBeenCalled();
        expect(onClear).toHaveBeenCalled();
    });

    it("skips the grounded follow-up when groundedLookup is off", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() =>
            useAccountIdentity(baseArgs({ groundedLookup: false, transport: fn }))
        );

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle(domainResult(null));
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe("grounded follow-up", () => {
    it("runs the grounded lookup after the idle window, then polls knowledgeOnly", async () => {
        const { fn, calls } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo, transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        await act(async () => {
            calls[0].settle(domainResult(null));
        });

        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS - DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(2);
        expect(calls[1].args.groundedLookup).toBe(true);

        await act(async () => {
            calls[1].settle({ ...domainResult(null), grounding: true });
        });
        await act(async () => {
            jest.advanceTimersByTime(RECHECK_MS);
        });
        expect(fn).toHaveBeenCalledTimes(3);
        expect(calls[2].args.knowledgeOnly).toBe(true);

        await act(async () => {
            calls[2].settle(domainResult("chase.com"));
        });
        expect(fetchImage).toHaveBeenCalledWith({
            domain: "chase.com",
            name: UNKNOWN,
        });
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
    });
});

describe("acceptance and gating", () => {
    it("clears a previously suggested logo when the fetch rejects the image", async () => {
        const fetchImage = jest.fn(async () => NO_LOGO);
        const onLogo = jest.fn();
        const onClear = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onClear, onLogo })));

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(onLogo).not.toHaveBeenCalled();
        expect(onClear).toHaveBeenCalled();
    });

    it("leaves the tile alone while canAttach answers false", async () => {
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const onClear = jest.fn();
        const { result } = await renderHook(() =>
            useAccountIdentity(baseArgs({ canAttach: () => false, fetchImage, onClear, onLogo }))
        );

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fetchImage).not.toHaveBeenCalled();
        expect(onLogo).not.toHaveBeenCalled();
        expect(onClear).not.toHaveBeenCalled();
    });

    it("drops a logo that lands after the name moved on", async () => {
        let settleFetch: (outcome: LogoOutcome) => void = () => {};
        const fetchImage = jest.fn(
            () =>
                new Promise<LogoOutcome>((resolve) => {
                    settleFetch = resolve;
                })
        );
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo })));

        result.current.onNameChange("netflix");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fetchImage).toHaveBeenCalledTimes(1);

        // A short name debounces to an empty suggestion, which takes a new ticket.
        result.current.onNameChange("hi");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        await act(async () => {
            settleFetch(LOGO);
        });
        expect(onLogo).not.toHaveBeenCalled();
    });
});
