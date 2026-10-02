import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { useAuthSession } from "@/lib/auth-session";
import { mirrorEntitlement } from "@/lib/entitlement-mirror";
import {
    configureRevenueCat,
    getPackages as getRevenueCatPackages,
    hasProEntitlement,
    eligibleForTrial,
    identifyUser,
    logOutUser,
    onCustomerInfoUpdated,
    purchaseAndCheckPro,
    purchaseCancelled,
    refreshProEntitlement,
    restoreAndCheckPro,
    setCustomerProfile,
} from "@/lib/revenuecat";

export type PurchaseOutcome = "cancelled" | "pro" | "unentitled";

export interface RevenueCatValue {
    getPackages: () => Promise<PurchasesPackage[]>;
    eligibleForTrial: (productIds: readonly string[]) => Promise<ReadonlySet<string>>;
    isConfigured: boolean;
    /**
     * Whether an entitlement question is in the air. Bounded by the requests
     * themselves: a gate that must not act on a guess can hold on this without
     * risking a hold that never ends.
     */
    isPending: boolean;
    /** False until the first identity sync answers, so no gate reads a guess. */
    isResolved: boolean;
    isPro: boolean;
    /** Whether the account carries the entitlement the SERVER gates on. */
    isMirrored: boolean;
    mirrorEntitlement: () => Promise<boolean>;
    purchasePackage: (pack: PurchasesPackage) => Promise<PurchaseOutcome>;
    refreshEntitlement: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
}

const NOT_CONFIGURED: RevenueCatValue = {
    eligibleForTrial: async () => new Set(),
    getPackages: async () => [],
    isConfigured: false,
    isMirrored: false,
    isPending: false,
    isPro: false,
    isResolved: true,
    mirrorEntitlement: async () => false,
    purchasePackage: async () => "cancelled",
    refreshEntitlement: async () => false,
    restorePurchases: async () => false,
};

const RevenueCatContext = createContext<RevenueCatValue>(NOT_CONFIGURED);

export function useRevenueCat(): RevenueCatValue {
    return use(RevenueCatContext);
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
    const { accountId, profile } = useAuthSession();
    const email = profile?.email;
    const name = profile?.name;
    const [isConfigured] = useState(configureRevenueCat);
    const [isPro, setIsPro] = useState(false);
    const [isResolved, setIsResolved] = useState(false);
    const [isMirrored, setIsMirrored] = useState(false);
    // Starts closed on a configured build: the identity sync below is requested
    // on mount, so anything waiting on an answer must not see a gap first.
    const [identityPending, setIdentityPending] = useState(() => isConfigured);
    const [mirrorPending, setMirrorPending] = useState(false);
    // Whether the mirror has answered for this entitlement AT ALL, success or
    // refusal. Separate from `isMirrored` so the gap between a positive store
    // answer and the request it triggers still counts as pending, without a
    // refusal leaving anything waiting forever.
    const [mirrorAnswered, setMirrorAnswered] = useState(false);
    const identityQueue = useRef(Promise.resolve());
    const identityTicket = useRef(0);
    const appliedIdentity = useRef<string | null | undefined>(undefined);
    const requestedIdentity = useRef<string | null | undefined>(undefined);
    const pendingRequest = useRef<{ target: string | null; ticket: number } | null>(null);
    const mirroredFor = useRef<string | null>(null);
    const mirrorTicket = useRef(0);
    const mirrorInFlight = useRef<{ account: string | null; promise: Promise<boolean> } | null>(null);

    /**
     * Every write of the entitlement goes through here, because losing it also
     * invalidates the server mirror: a customer who lapses and re-subscribes
     * must be mirrored again before anything gated is allowed to run, and a
     * mirror still in flight must not land its answer afterwards.
     */
    const applyPro = useCallback((pro: boolean) => {
        setIsPro(pro);
        if (!pro) {
            mirroredFor.current = null;
            mirrorInFlight.current = null;
            mirrorTicket.current += 1;
            setIsMirrored(false);
            // Dropping the in-flight entry orphans that request's own cleanup,
            // so the flags it owns have to be released here or nothing ever
            // will — and anything holding on `isPending` would wait forever.
            setMirrorPending(false);
            setMirrorAnswered(false);
        }
    }, []);

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        return onCustomerInfoUpdated((customerInfo) => {
            if (pendingRequest.current === null && appliedIdentity.current === requestedIdentity.current) {
                applyPro(hasProEntitlement(customerInfo));
            }
        });
    }, [applyPro, isConfigured]);

    const syncIdentity = useCallback(
        (target: string | null) => {
            if (pendingRequest.current?.target === target) {
                return;
            }
            if (target !== appliedIdentity.current) {
                applyPro(false);
                setIsResolved(false);
            }
            requestedIdentity.current = target;
            identityTicket.current += 1;
            const ticket = identityTicket.current;
            pendingRequest.current = { target, ticket };
            setIdentityPending(true);
            identityQueue.current = identityQueue.current
                .then(() => (target === null ? logOutUser() : identifyUser(target)))
                .then((pro) => {
                    appliedIdentity.current = target;
                    if (ticket === identityTicket.current) {
                        applyPro(pro);
                        setIsResolved(true);
                    }
                })
                .catch((error) => {
                    console.warn("[revenuecat] identity sync failed", error);
                })
                .finally(() => {
                    if (pendingRequest.current?.ticket === ticket) {
                        pendingRequest.current = null;
                        // Cleared whether the sync answered or threw, so a gate
                        // waiting on it is never held by a request that is over.
                        setIdentityPending(false);
                    }
                });
        },
        [applyPro]
    );

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        syncIdentity(accountId);
    }, [accountId, isConfigured, syncIdentity]);

    useEffect(() => {
        if (!isResolved || email === undefined || name === undefined || appliedIdentity.current !== accountId) {
            return;
        }
        identityQueue.current = identityQueue.current
            .then(() => setCustomerProfile({ email, name }))
            .catch((error) => {
                console.warn("[revenuecat] profile sync failed", error);
            });
    }, [accountId, email, isResolved, name]);

    const runForSession = useCallback(
        <T,>(op: () => Promise<T>, fallback: T, apply?: (result: T) => void): Promise<T> => {
            if (!isConfigured) {
                return Promise.resolve(fallback);
            }
            if (appliedIdentity.current !== accountId || requestedIdentity.current !== accountId) {
                syncIdentity(accountId);
            }
            const ticket = identityTicket.current;
            const run = identityQueue.current.then(() => {
                if (ticket !== identityTicket.current || appliedIdentity.current !== accountId) {
                    throw new Error("RevenueCat identity does not match the signed-in account");
                }
                return op();
            });
            identityQueue.current = run.then(
                () => undefined,
                () => undefined
            );
            return run.then((result) => {
                if (ticket !== identityTicket.current) {
                    throw new Error("RevenueCat identity changed while the call was running");
                }
                apply?.(result);
                return result;
            });
        },
        [accountId, isConfigured, syncIdentity]
    );

    const refreshEntitlement = useCallback(
        () => runForSession(refreshProEntitlement, false, applyPro),
        [applyPro, runForSession]
    );

    // The server reads its own mirror, not the store, so an entitlement the SDK
    // reports has to be copied across before anything gated on it will answer.
    // Checkout awaits this for its own message; the effect below covers the
    // customer who already owned Pro when the mirror shipped, and any purchase
    // whose webhook was missed.
    const mirror = useCallback(async (): Promise<boolean> => {
        // Checkout and the effect below both ask, and they overlap: the purchase
        // sets `isPro` before it resolves. One request answers both, or a
        // transient failure on the second would overwrite the first's success.
        // Keyed by account: a request for the previous customer answers nothing
        // for this one, and returning it would leave the new account unmirrored
        // with nothing left to re-trigger the attempt.
        const inFlight = mirrorInFlight.current;
        if (inFlight !== null && inFlight.account === accountId) {
            return await inFlight.promise;
        }
        const ticket = mirrorTicket.current;
        const run = mirrorEntitlement().then((mirrored) => {
            // The entitlement was lost while this was in the air, so its answer
            // describes a customer who is no longer the one being gated.
            if (ticket !== mirrorTicket.current) {
                return false;
            }
            // Recorded only on success, so a refusal is retried rather than
            // remembered — `mirrorEntitlement` reports one as `false`.
            mirroredFor.current = mirrored ? accountId : null;
            setIsMirrored(mirrored);
            return mirrored;
        });
        mirrorInFlight.current = { account: accountId, promise: run };
        setMirrorPending(true);
        run.catch(() => undefined).finally(() => {
            if (mirrorInFlight.current?.promise === run) {
                mirrorInFlight.current = null;
                setMirrorPending(false);
                setMirrorAnswered(true);
            }
        });
        return await run;
    }, [accountId]);

    const mirrorOnce = useCallback(() => {
        if (!isConfigured || !isPro || accountId === null || mirroredFor.current === accountId) {
            return;
        }
        mirror().catch((error) => {
            console.warn("[revenuecat] entitlement mirror failed", error);
        });
    }, [accountId, isConfigured, isPro, mirror]);

    useEffect(mirrorOnce, [mirrorOnce]);

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                refreshEntitlement()
                    // A mirror that was refused earlier gets its next attempt here:
                    // the entitlement state does not change, so nothing else in the
                    // session would ask again.
                    .then(mirrorOnce)
                    .catch((error) => {
                        console.warn("[revenuecat] foreground entitlement read failed", error);
                    });
            }
        });
        return () => {
            subscription.remove();
        };
    }, [isConfigured, mirrorOnce, refreshEntitlement]);

    const getPackages = useCallback(() => runForSession(getRevenueCatPackages, []), [runForSession]);

    const trialEligible = useCallback(
        (productIds: readonly string[]) => runForSession(() => eligibleForTrial(productIds), new Set<string>()),
        [runForSession]
    );

    const purchasePackage = useCallback(
        (pack: PurchasesPackage) =>
            runForSession<PurchaseOutcome>(
                async () => {
                    try {
                        return (await purchaseAndCheckPro(pack)) ? "pro" : "unentitled";
                    } catch (error) {
                        if (purchaseCancelled.safeParse(error).success) {
                            return (await refreshProEntitlement()) ? "pro" : "cancelled";
                        }
                        throw error;
                    }
                },
                "cancelled",
                (outcome) => applyPro(outcome === "pro")
            ),
        [applyPro, runForSession]
    );

    const restorePurchases = useCallback(
        () => runForSession(restoreAndCheckPro, false, applyPro),
        [applyPro, runForSession]
    );

    const value = useMemo<RevenueCatValue>(
        () => ({
            eligibleForTrial: trialEligible,
            getPackages,
            isConfigured,
            isMirrored,
            // `isPro && !mirrorAnswered` covers the render between the store
            // saying yes and the mirror request starting: without it a gate
            // reads a gap as "not entitled" and acts on it.
            isPending: identityPending || mirrorPending || (isPro && !mirrorAnswered),
            isPro,
            isResolved,
            mirrorEntitlement: mirror,
            purchasePackage,
            refreshEntitlement,
            restorePurchases,
        }),
        [
            getPackages,
            identityPending,
            isConfigured,
            isMirrored,
            isPro,
            isResolved,
            mirror,
            mirrorAnswered,
            mirrorPending,
            purchasePackage,
            refreshEntitlement,
            restorePurchases,
            trialEligible,
        ]
    );

    return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}
