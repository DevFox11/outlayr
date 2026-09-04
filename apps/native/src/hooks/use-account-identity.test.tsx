import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
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

    it("resolves a bank on-device and never asks the model", async () => {
        const { fn } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo, transport: fn })));

        result.current.onNameChange("Chase");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS + GROUNDED_IDLE_MS);
        });

        expect(fetchImage).toHaveBeenCalledWith({
            domain: "chase.com",
            name: "Chase",
        });
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
        // The point of the institution tier: no round trip, so it also works
        // signed out and offline.
        expect(fn).not.toHaveBeenCalled();
    });

    it("still resolves a bank when aiEnrichment is off", async () => {
        const { fn } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() =>
            useAccountIdentity(baseArgs({ fetchImage, onLogo, remoteEnabled: false, transport: fn }))
        );

        result.current.onNameChange("Banesco");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fetchImage).toHaveBeenCalledWith({
            domain: "banesco.com",
            name: "Banesco",
        });
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
        expect(fn).not.toHaveBeenCalled();
    });

    /**
     * The race Codex found on #486: an outstanding remote lookup for the
     * PREVIOUS name settling after a bank resolved locally. Nothing bumped the
     * request ticket on the local answer, so the late result still counted as
     * current and its logo landed on this account.
     */
    it("drops an older remote result that settles after a bank resolved locally", async () => {
        const { fn, calls } = deferredTransport();
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, onLogo, transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(1);

        // The field moves to a bank, which the institution map answers on device.
        result.current.onNameChange("Chase");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fetchImage).toHaveBeenCalledWith({ domain: "chase.com", name: "Chase" });

        fetchImage.mockClear();
        await act(async () => {
            calls[0].settle(domainResult("zzq-unresolvable.example"));
        });

        // The stale answer must not reach the tile at all.
        expect(fetchImage).not.toHaveBeenCalled();
    });

    /**
     * The follow-on Codex found: superseding the ticket left the abandoned key
     * in the dedupe set, so returning to that name before its call settled made
     * `run` refuse to start a replacement — and the discarded result meant
     * nothing ever answered, stranding the bank's logo on the wrong name.
     */
    it("re-asks for a name whose earlier lookup was superseded and abandoned", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(1);

        // A local answer supersedes that outstanding request.
        result.current.onNameChange("Chase");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        // Back to the first name while its abandoned call is still pending.
        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fn).toHaveBeenCalledTimes(2);
        expect(calls).toHaveLength(2);
    });

    /**
     * A superseded request still settles. It must not delete the dedupe entry a
     * later request for the same key now owns, or `run` starts a third lookup;
     * and it must not record its outcome, or `runGroundedFollowUp` answers for a
     * name the user has left — suppressing the grounded pass the live result
     * deserves, or spending one it does not.
     */
    it("lets a superseded request settle without disturbing the live one", async () => {
        const { fn, calls } = deferredTransport();
        const { result } = await renderHook(() => useAccountIdentity(baseArgs({ transport: fn })));

        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        result.current.onNameChange("Chase");
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(2);

        // The abandoned first call lands, claiming a domain.
        await act(async () => {
            calls[0].settle(domainResult("zzq-superseded.example"));
        });

        // Its entry is not the live request's, so nothing was freed: another
        // pass for the same name must not open a third request.
        result.current.onNameChange(UNKNOWN);
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(2);

        // And its outcome was not recorded, so the live domain-less result still
        // earns its grounded follow-up.
        await act(async () => {
            calls[1].settle(domainResult(null));
        });
        await act(async () => {
            jest.advanceTimersByTime(GROUNDED_IDLE_MS);
        });
        expect(fn).toHaveBeenCalledTimes(3);
        expect(fn.mock.calls[2][0].groundedLookup).toBe(true);
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
        expect(onClear).toHaveBeenCalledWith();
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
        expect(onClear).toHaveBeenCalledWith();
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
        expect(onClear).toHaveBeenCalledWith();
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

describe("a name the editor opens with", () => {
    it("is looked up on mount as if it had been typed", async () => {
        const fetchImage = jest.fn(async () => LOGO);
        const onLogo = jest.fn();
        await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, initialName: "Banesco", onLogo })));

        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fetchImage).toHaveBeenCalledWith({ domain: "banesco.com", name: "Banesco" });
        await act(async () => {});
        expect(onLogo).toHaveBeenCalledWith(PERSISTED);
    });

    it("asks nothing for an empty or disabled opening name", async () => {
        const fetchImage = jest.fn(async () => LOGO);
        await renderHook(() => useAccountIdentity(baseArgs({ fetchImage, initialName: "  " })));
        await renderHook(() => useAccountIdentity(baseArgs({ enabled: false, fetchImage, initialName: "Banesco" })));

        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        expect(fetchImage).not.toHaveBeenCalled();
    });
});

describe("an editor that closes mid-lookup", () => {
    it("drops a logo that lands after the hook unmounted", async () => {
        let settleFetch: (outcome: LogoOutcome) => void = () => {};
        const fetchImage = jest.fn(
            () =>
                new Promise<LogoOutcome>((resolve) => {
                    settleFetch = resolve;
                })
        );
        const onLogo = jest.fn();
        const onClear = jest.fn();
        const { unmount } = await renderHook(() =>
            useAccountIdentity(baseArgs({ fetchImage, initialName: "Banesco", onClear, onLogo }))
        );

        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(fetchImage).toHaveBeenCalledTimes(1);

        unmount();
        await act(async () => {
            settleFetch(LOGO);
        });
        expect(onLogo).not.toHaveBeenCalled();
        expect(onClear).not.toHaveBeenCalled();
    });
});
