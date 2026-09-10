import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, render, renderHook } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { AppState, Text } from "react-native";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";

import { RevenueCatProvider, useRevenueCat } from "./revenuecat-context";
import type { PurchaseOutcome } from "./revenuecat-context";

const mockSession: { accountId: string | null } = { accountId: null };
const mockCustomerInfo: { listener: ((info: CustomerInfo) => void) | null } = { listener: null };

jest.mock<Partial<typeof import("@/lib/auth-session")>>("@/lib/auth-session", () => ({
    useAuthSession: () => ({
        accountId: mockSession.accountId,
        activate: () => undefined,
        begin: () => undefined,
        gate: "signed-in",
        reject: () => undefined,
    }),
}));

jest.mock<typeof import("@/lib/revenuecat")>("@/lib/revenuecat", () => ({
    PRO_ENTITLEMENT_ID: "pro",
    configureRevenueCat: () => true,
    eligibleForTrial: jest.fn(async () => new Set<string>()),
    getPackages: jest.fn(async () => []),
    hasProEntitlement: (info: CustomerInfo | null) => info?.entitlements.active.pro !== undefined,
    identifyUser: jest.fn(async () => true),
    logOutUser: jest.fn(async () => false),
    onCustomerInfoUpdated: (listener: (info: CustomerInfo) => void) => {
        mockCustomerInfo.listener = listener;
        return () => undefined;
    },
    purchaseAndCheckPro: jest.fn(async () => false),
    purchaseCancelled: { safeParse: () => ({ success: false }) } as never,
    refreshProEntitlement: jest.fn(async () => false),
    restoreAndCheckPro: jest.fn(async () => false),
}));

const mockMirror = jest.fn<() => Promise<boolean>>(async () => true);
jest.mock("@/lib/entitlement-mirror", () => ({ mirrorEntitlement: () => mockMirror() }));

const sdk = jest.mocked(jest.requireMock<typeof import("@/lib/revenuecat")>("@/lib/revenuecat"));

beforeEach(() => {
    jest.clearAllMocks();
    mockMirror.mockResolvedValue(true);
});

function Probe() {
    return <Text testID="pro">{String(useRevenueCat().isPro)}</Text>;
}

function foreground() {
    const { calls } = jest.mocked(AppState.addEventListener).mock;
    const handler = calls.at(-1)?.[1];
    if (!handler) {
        throw new Error("Expected an AppState listener");
    }
    handler("active");
}

describe("revenueCatProvider identity", () => {
    it("keeps a newer request for the same account pending when an older one settles", async () => {
        let rejectFirst: (error: Error) => void = () => undefined;
        let releaseOther: (pro: boolean) => void = () => undefined;
        sdk.identifyUser
            .mockImplementationOnce(
                () =>
                    new Promise<boolean>((_resolve, reject) => {
                        rejectFirst = reject;
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise<boolean>((resolve) => {
                        releaseOther = resolve;
                    })
            );
        mockSession.accountId = "user-22";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        mockSession.accountId = "user-23";
        await rerender(undefined);
        mockSession.accountId = "user-22";
        await rerender(undefined);
        let packages: Promise<PurchasesPackage[]> = Promise.resolve([]);
        await act(async () => {
            packages = result.current.getPackages();
            packages.catch(() => undefined);
        });

        await act(async () => {
            rejectFirst(new Error("network"));
        });
        await act(async () => {
            foreground();
        });
        await act(async () => {
            releaseOther(false);
        });

        await expect(packages).resolves.toStrictEqual([]);
    });

    it("re-syncs for a child's call when a sign-out for the same account is still pending", async () => {
        let releaseLogOut: (pro: boolean) => void = () => undefined;
        mockSession.accountId = "user-21";
        const { result, rerender } = await renderHook(
            () => {
                const { getPackages } = useRevenueCat();
                const [outcome, setOutcome] = useState("pending");
                useEffect(() => {
                    if (mockSession.accountId !== "user-21") {
                        return;
                    }
                    getPackages()
                        .then(() => setOutcome("ok"))
                        .catch(() => setOutcome("rejected"));
                }, [getPackages]);
                return outcome;
            },
            { wrapper: RevenueCatProvider }
        );
        await act(async () => undefined);
        expect(result.current).toBe("ok");

        sdk.logOutUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogOut = resolve;
                })
        );
        mockSession.accountId = null;
        await rerender(undefined);
        mockSession.accountId = "user-21";
        await rerender(undefined);
        await act(async () => {
            releaseLogOut(false);
        });

        expect(result.current).toBe("ok");
        expect(sdk.identifyUser).toHaveBeenCalledTimes(2);
    });

    it("ignores a customer-info push while the first sign-in has failed", async () => {
        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-20";
        const { getByTestId } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);
        await act(async () => {
            // SAFETY: only `entitlements.active` is read.
            mockCustomerInfo.listener?.({ entitlements: { active: { pro: {} } } } as unknown as CustomerInfo);
        });

        expect(getByTestId("pro").props.children).toBe("false");
    });

    it("serves an offerings call made from a child's mount effect", async () => {
        mockSession.accountId = "user-19";
        const { result } = await renderHook(
            () => {
                const { getPackages } = useRevenueCat();
                const [outcome, setOutcome] = useState("pending");
                useEffect(() => {
                    getPackages()
                        .then(() => setOutcome("ok"))
                        .catch(() => setOutcome("rejected"));
                }, [getPackages]);
                return outcome;
            },
            { wrapper: RevenueCatProvider }
        );
        await act(async () => undefined);

        expect(result.current).toBe("ok");
        expect(sdk.getPackages).toHaveBeenCalledTimes(1);
        expect(sdk.identifyUser).toHaveBeenCalledTimes(1);
    });

    it("rejects an offerings call whose session changed while it ran", async () => {
        let releasePackages: (packages: PurchasesPackage[]) => void = () => undefined;
        sdk.getPackages.mockImplementationOnce(
            () =>
                new Promise<PurchasesPackage[]>((resolve) => {
                    releasePackages = resolve;
                })
        );
        mockSession.accountId = "user-17";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        let packages: Promise<PurchasesPackage[]> = Promise.resolve([]);
        await act(async () => {
            packages = result.current.getPackages();
            packages.catch(() => undefined);
        });
        expect(sdk.getPackages).toHaveBeenCalledTimes(1);

        mockSession.accountId = "user-18";
        await rerender(undefined);
        await act(async () => {
            releasePackages([]);
        });

        await expect(packages).rejects.toThrow("identity");
    });

    it("drops a purchase queued for an account that signed out before it started", async () => {
        let releaseLogIn: (pro: boolean) => void = () => undefined;
        sdk.identifyUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogIn = resolve;
                })
        );
        mockSession.accountId = "user-16";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        // SAFETY: the provider hands the package straight to the mocked SDK; nothing on it is read.
        const pack = { identifier: "$rc_annual" } as unknown as PurchasesPackage;
        let purchase: Promise<PurchaseOutcome> = Promise.resolve("cancelled");
        await act(async () => {
            purchase = result.current.purchasePackage(pack);
            purchase.catch(() => undefined);
        });

        mockSession.accountId = null;
        await rerender(undefined);
        await act(async () => {
            releaseLogIn(true);
        });

        expect(sdk.purchaseAndCheckPro).not.toHaveBeenCalled();
        await expect(purchase).rejects.toThrow("identity");
    });

    it("ignores a customer-info push from the previous account after the session changed", async () => {
        mockSession.accountId = "user-14";
        const { getByTestId, rerender } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);

        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-15";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => {
            // SAFETY: only `entitlements.active` is read.
            mockCustomerInfo.listener?.({ entitlements: { active: { pro: {} } } } as unknown as CustomerInfo);
        });

        expect(getByTestId("pro").props.children).toBe("false");
    });

    it("ignores a customer-info push while a superseded sign-in is still landing", async () => {
        mockSession.accountId = "user-30";
        const { getByTestId, rerender } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);

        let releaseOther: (pro: boolean) => void = () => undefined;
        sdk.identifyUser
            .mockImplementationOnce(
                () =>
                    new Promise<boolean>((resolve) => {
                        releaseOther = resolve;
                    })
            )
            .mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-31";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        mockSession.accountId = "user-30";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => {
            // SAFETY: only `entitlements.active` is read.
            mockCustomerInfo.listener?.({ entitlements: { active: { pro: {} } } } as unknown as CustomerInfo);
        });
        expect(getByTestId("pro").props.children).toBe("false");

        await act(async () => {
            releaseOther(true);
        });
        expect(getByTestId("pro").props.children).toBe("false");
    });

    it("discards a superseded read that would restore the previous account's Pro", async () => {
        let releaseRefresh: (pro: boolean) => void = () => undefined;
        sdk.refreshProEntitlement.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseRefresh = resolve;
                })
        );
        mockSession.accountId = "user-12";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        await act(async () => {
            result.current.refreshEntitlement().catch(() => undefined);
        });

        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-13";
        await rerender(undefined);
        await act(async () => {
            releaseRefresh(true);
        });

        expect(result.current.isPro).toBe(false);
    });

    it("stops reporting the previous account as Pro once the session changes", async () => {
        mockSession.accountId = "user-10";
        const { getByTestId, rerender } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);
        expect(getByTestId("pro").props.children).toBe("true");

        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-11";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);

        expect(getByTestId("pro").props.children).toBe("false");
    });

    it("holds an identity change behind an in-flight purchase", async () => {
        let releasePurchase: (pro: boolean) => void = () => undefined;
        sdk.purchaseAndCheckPro.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releasePurchase = resolve;
                })
        );
        mockSession.accountId = "user-7";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        // SAFETY: the provider hands the package straight to the mocked SDK; nothing on it is read.
        const pack = { identifier: "$rc_annual" } as unknown as PurchasesPackage;
        await act(async () => {
            result.current.purchasePackage(pack).catch(() => undefined);
        });
        expect(sdk.purchaseAndCheckPro).toHaveBeenCalledTimes(1);

        mockSession.accountId = null;
        await rerender(undefined);
        expect(sdk.logOutUser).not.toHaveBeenCalled();

        await act(async () => {
            releasePurchase(true);
        });
        expect(sdk.logOutUser).toHaveBeenCalledTimes(1);
    });

    it("drops a refresh that settles after the session changed", async () => {
        let releaseRefresh: (pro: boolean) => void = () => undefined;
        sdk.refreshProEntitlement.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseRefresh = resolve;
                })
        );
        mockSession.accountId = "user-8";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        await act(async () => {
            result.current.refreshEntitlement().catch(() => undefined);
        });

        sdk.identifyUser.mockResolvedValueOnce(false);
        mockSession.accountId = "user-9";
        await rerender(undefined);
        await act(async () => {
            releaseRefresh(true);
        });

        expect(sdk.identifyUser).toHaveBeenLastCalledWith("user-9");
        expect(result.current.isPro).toBe(false);
    });

    it("retries a sign-in that failed after a superseded sign-out had landed", async () => {
        let releaseLogOut: (pro: boolean) => void = () => undefined;
        mockSession.accountId = "user-6";
        const { rerender } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);

        sdk.logOutUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogOut = resolve;
                })
        );
        mockSession.accountId = null;
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        mockSession.accountId = "user-6";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => {
            releaseLogOut(false);
        });
        expect(sdk.identifyUser).toHaveBeenCalledTimes(2);

        await act(async () => {
            foreground();
        });

        expect(sdk.identifyUser).toHaveBeenCalledTimes(3);
    });

    it("reads the entitlement only through the identity sync at mount", async () => {
        mockSession.accountId = "user-4";
        const { getByTestId } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);

        expect(sdk.refreshProEntitlement).not.toHaveBeenCalled();
        expect(sdk.identifyUser).toHaveBeenCalledWith("user-4");
        expect(getByTestId("pro").props.children).toBe("true");
    });

    it("holds the offerings until the queued sign-in has landed", async () => {
        let releaseLogIn: (pro: boolean) => void = () => undefined;
        sdk.identifyUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogIn = resolve;
                })
        );
        mockSession.accountId = "user-5";
        const { result } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });

        await act(async () => {
            result.current.getPackages();
        });
        expect(sdk.getPackages).not.toHaveBeenCalled();

        await act(async () => {
            releaseLogIn(true);
        });

        expect(sdk.getPackages).toHaveBeenCalledTimes(1);
    });

    it("holds a purchase until the queued sign-in has landed", async () => {
        let releaseLogIn: (pro: boolean) => void = () => undefined;
        sdk.identifyUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogIn = resolve;
                })
        );
        mockSession.accountId = "user-3";
        const { result } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        // SAFETY: the provider hands the package straight to the mocked SDK; nothing on it is read.
        const pack = { identifier: "$rc_annual" } as unknown as PurchasesPackage;

        let purchase: Promise<PurchaseOutcome> = Promise.resolve("cancelled");
        await act(async () => {
            purchase = result.current.purchasePackage(pack);
        });
        expect(sdk.purchaseAndCheckPro).not.toHaveBeenCalled();

        await act(async () => {
            releaseLogIn(false);
        });

        expect(sdk.purchaseAndCheckPro).toHaveBeenCalledWith(pack);
        await expect(purchase).resolves.toBe("unentitled");
    });

    it("retries the account identity on foreground after a failed sign-in", async () => {
        sdk.identifyUser.mockRejectedValueOnce(new Error("network"));
        sdk.refreshProEntitlement.mockResolvedValueOnce(true);
        mockSession.accountId = "user-2";
        const { getByTestId } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        await act(async () => undefined);
        expect(sdk.identifyUser).toHaveBeenCalledTimes(1);
        expect(getByTestId("pro").props.children).toBe("false");

        await act(async () => {
            foreground();
        });

        expect(sdk.identifyUser).toHaveBeenCalledTimes(2);
        expect(sdk.identifyUser).toHaveBeenLastCalledWith("user-2");
        expect(getByTestId("pro").props.children).toBe("true");
    });

    it("runs a sign-in after a still-pending sign-out, and keeps the newer result", async () => {
        let releaseLogOut: (pro: boolean) => void = () => undefined;
        sdk.logOutUser.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseLogOut = resolve;
                })
        );
        mockSession.accountId = null;
        const { getByTestId, rerender } = await render(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        expect(sdk.logOutUser).toHaveBeenCalledTimes(1);

        mockSession.accountId = "user-1";
        await rerender(
            <RevenueCatProvider>
                <Probe />
            </RevenueCatProvider>
        );
        expect(sdk.identifyUser).not.toHaveBeenCalled();

        await act(async () => {
            releaseLogOut(false);
        });

        expect(sdk.identifyUser).toHaveBeenCalledWith("user-1");
        expect(sdk.identifyUser.mock.invocationCallOrder[0]).toBeGreaterThan(
            sdk.logOutUser.mock.invocationCallOrder[0]
        );
        expect(getByTestId("pro").props.children).toBe("true");
    });
});

/**
 * `isPending` gates the ledger-adoption cover, so it has to be true whenever an
 * answer is still coming AND false whenever one can no longer arrive: a gap
 * settles adoption early, and a stuck flag holds the app behind a splash.
 */
describe("revenueCatProvider entitlement pending", () => {
    it("stays pending from mount until the mirror answers for a Pro customer", async () => {
        let releaseMirror: (mirrored: boolean) => void = () => undefined;
        mockMirror.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseMirror = resolve;
                })
        );
        mockSession.accountId = "user-30";

        const { result } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });

        // The store has answered Pro, but the mirror it triggers has not.
        expect(result.current.isPro).toBe(true);
        expect(result.current.isMirrored).toBe(false);
        expect(result.current.isPending).toBe(true);

        await act(async () => {
            releaseMirror(true);
        });

        expect(result.current.isMirrored).toBe(true);
        expect(result.current.isPending).toBe(false);
    });

    it("never reports a settled gap between the store saying Pro and the mirror starting", async () => {
        // Every commit, not just the settled one: the gap this guards against is
        // a single render, and an effect elsewhere in the tree acts on it.
        const seen: { mirrored: boolean; pending: boolean; pro: boolean }[] = [];
        function Recorder() {
            const { isMirrored, isPending, isPro } = useRevenueCat();
            useEffect(() => {
                seen.push({ mirrored: isMirrored, pending: isPending, pro: isPro });
            });
            return null;
        }
        let releaseMirror: (mirrored: boolean) => void = () => undefined;
        mockMirror.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseMirror = resolve;
                })
        );
        mockSession.accountId = "user-34";

        await render(
            <RevenueCatProvider>
                <Recorder />
            </RevenueCatProvider>
        );
        await act(async () => {
            releaseMirror(true);
        });

        expect(seen.filter((frame) => frame.pro && !frame.mirrored && !frame.pending)).toStrictEqual([]);
    });

    it("stops pending when the mirror refuses, rather than waiting on an answer that came", async () => {
        mockMirror.mockResolvedValue(false);
        mockSession.accountId = "user-31";

        const { result } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });

        expect(result.current.isMirrored).toBe(false);
        expect(result.current.isPending).toBe(false);
    });

    it("stops pending for a Free account that replaces one whose mirror never landed", async () => {
        // Never settles: the account switch has to release the flags this
        // request would otherwise have owned.
        mockMirror.mockReturnValue(
            new Promise<boolean>(() => {
                // Deliberately abandoned.
            })
        );
        sdk.identifyUser.mockImplementation(async (accountId: string) => accountId === "user-32");
        mockSession.accountId = "user-32";
        const { result, rerender } = await renderHook(() => useRevenueCat(), { wrapper: RevenueCatProvider });
        expect(result.current.isPending).toBe(true);

        mockSession.accountId = "user-33";
        await rerender(undefined);

        expect(result.current.isPro).toBe(false);
        expect(result.current.isPending).toBe(false);
    });
});
