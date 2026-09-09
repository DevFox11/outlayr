import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

import { useAuthSession } from "@/lib/auth-session";
import {
    configureRevenueCat,
    getPackages as getRevenueCatPackages,
    hasProEntitlement,
    identifyUser,
    logOutUser,
    onCustomerInfoUpdated,
    purchaseAndCheckPro,
    purchaseCancelled,
    refreshProEntitlement,
    restoreAndCheckPro,
} from "@/lib/revenuecat";

export interface RevenueCatValue {
    getPackages: () => Promise<PurchasesPackage[]>;
    isConfigured: boolean;
    isPro: boolean;
    purchasePackage: (pack: PurchasesPackage) => Promise<boolean>;
    refreshEntitlement: () => Promise<boolean>;
    restorePurchases: () => Promise<boolean>;
}

const NOT_CONFIGURED: RevenueCatValue = {
    getPackages: async () => [],
    isConfigured: false,
    isPro: false,
    purchasePackage: async () => false,
    refreshEntitlement: async () => false,
    restorePurchases: async () => false,
};

const RevenueCatContext = createContext<RevenueCatValue>(NOT_CONFIGURED);

export function useRevenueCat(): RevenueCatValue {
    return use(RevenueCatContext);
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
    const { accountId } = useAuthSession();
    const [isConfigured] = useState(configureRevenueCat);
    const [isPro, setIsPro] = useState(false);
    const identityQueue = useRef(Promise.resolve());
    const identityTicket = useRef(0);
    const appliedIdentity = useRef<string | null | undefined>(undefined);
    const requestedIdentity = useRef<string | null | undefined>(undefined);
    const pendingRequest = useRef<{ target: string | null; ticket: number } | null>(null);

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        return onCustomerInfoUpdated((customerInfo) => {
            if (pendingRequest.current === null && appliedIdentity.current === requestedIdentity.current) {
                setIsPro(hasProEntitlement(customerInfo));
            }
        });
    }, [isConfigured]);

    const syncIdentity = useCallback((target: string | null) => {
        if (pendingRequest.current?.target === target) {
            return;
        }
        if (target !== appliedIdentity.current) {
            setIsPro(false);
        }
        requestedIdentity.current = target;
        identityTicket.current += 1;
        const ticket = identityTicket.current;
        pendingRequest.current = { target, ticket };
        identityQueue.current = identityQueue.current
            .then(() => (target === null ? logOutUser() : identifyUser(target)))
            .then((pro) => {
                appliedIdentity.current = target;
                if (ticket === identityTicket.current) {
                    setIsPro(pro);
                }
            })
            .catch((error) => {
                console.warn("[revenuecat] identity sync failed", error);
            })
            .finally(() => {
                if (pendingRequest.current?.ticket === ticket) {
                    pendingRequest.current = null;
                }
            });
    }, []);

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        syncIdentity(accountId);
    }, [accountId, isConfigured, syncIdentity]);

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
        () => runForSession(refreshProEntitlement, false, setIsPro),
        [runForSession]
    );

    useEffect(() => {
        if (!isConfigured) {
            return;
        }
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                refreshEntitlement().catch((error) => {
                    console.warn("[revenuecat] foreground entitlement read failed", error);
                });
            }
        });
        return () => {
            subscription.remove();
        };
    }, [isConfigured, refreshEntitlement]);

    const getPackages = useCallback(() => runForSession(getRevenueCatPackages, []), [runForSession]);

    const purchasePackage = useCallback(
        (pack: PurchasesPackage) =>
            runForSession(
                async () => {
                    try {
                        return await purchaseAndCheckPro(pack);
                    } catch (error) {
                        if (purchaseCancelled.safeParse(error).success) {
                            return refreshProEntitlement();
                        }
                        throw error;
                    }
                },
                false,
                setIsPro
            ),
        [runForSession]
    );

    const restorePurchases = useCallback(() => runForSession(restoreAndCheckPro, false, setIsPro), [runForSession]);

    const value = useMemo<RevenueCatValue>(
        () => ({ getPackages, isConfigured, isPro, purchasePackage, refreshEntitlement, restorePurchases }),
        [getPackages, isConfigured, isPro, purchasePackage, refreshEntitlement, restorePurchases]
    );

    return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}
