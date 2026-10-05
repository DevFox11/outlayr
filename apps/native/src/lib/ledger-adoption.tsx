import { eq } from "drizzle-orm";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { useDatabase } from "@/contexts/local-data-context";
import { createSingleAdoptionRetry } from "@/data/adoption-retry";
import { META_KEYS } from "@/data/app-meta-core";
import { completeAdoption, localLedgerState, prepareAccountAdoption } from "@/data/ledger-adoption";
import { useLiveQuery } from "@/data/live-query";
import { appMeta } from "@/db/schema";
import { adoptionActions, adoptionPlan, choiceActions } from "@/domain/ledger-adoption";
import type { AdoptionChoice } from "@/domain/ledger-adoption";
import { useProLocked, useProPending } from "@/hooks/use-pro-locked";
import { adoptionEngine } from "@/lib/adoption-engine";
import { useAuthSession } from "@/lib/auth-session";

export type AdoptionStatus = "resolving" | "settled" | "ask" | "working";

export interface LedgerAdoption {
    choose: (choice: AdoptionChoice) => void;
    failed: boolean;
    status: AdoptionStatus;
}

const SETTLED: LedgerAdoption = {
    choose: () => {
        // Nothing left to choose once adoption has settled.
    },
    failed: false,
    status: "settled",
};

const LedgerAdoptionContext = createContext<LedgerAdoption>(SETTLED);

export function useLedgerAdoption(): LedgerAdoption {
    return use(LedgerAdoptionContext);
}

/**
 * Reconciles what this device holds with what the account holds, once per
 * account. Must sit below the splash gate — it reads the database.
 *
 * A plan that cannot be decided settles without writing the marker, so the app
 * opens on the ledger it already has and the reconciliation stays due for the
 * first build that can actually run it. A failure does the same: nothing marked
 * means nothing skipped.
 */
export function LedgerAdoptionProvider({ children }: { children: ReactNode }) {
    const db = useDatabase();
    const { accountId } = useAuthSession();
    // Read during render rather than awaited, so a device that has already
    // reconciled never shows a frame of the cover on its way to the ledger.
    const rows = useLiveQuery(appMeta, () =>
        db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.ledgerAdoption))
    );
    const settled = accountId != null && (rows[0]?.value ?? null) === accountId;

    // Lazily, so the frame before the effect below runs is not a cover over an
    // app that had nothing to reconcile in the first place.
    const [status, setStatus] = useState<AdoptionStatus>(() =>
        accountId == null || settled ? "settled" : "resolving"
    );
    const [failed, setFailed] = useState(false);
    const confirmedFree = useProLocked();
    const entitlementPending = useProPending();
    const retryByAccount = useRef<{
        accountId: string;
        inFlight: Promise<AdoptionStatus> | null;
        retry: ReturnType<typeof createSingleAdoptionRetry>;
    } | null>(null);

    useEffect(() => {
        // Held rather than settled while the entitlement is still being
        // established: settling hands the local ledger to `RootStack`, and a
        // Pro customer on a new device could edit it before the account's
        // ledger has been reconciled, turning an automatic adoption into a
        // merge. The hold is bounded by the requests themselves.
        if (accountId != null && !settled && entitlementPending) {
            // oxlint-disable-next-line react/set-state-in-effect -- as below: one arm of the same async state machine.
            setStatus("resolving");
            return;
        }
        // Skipped only for a CONFIRMED Free customer, who has no account ledger
        // to reconcile against. Every other answer — Pro, unmirrored Pro, or a
        // store lookup that failed — reconciles, because settling would claim a
        // check that never ran. When the account cannot be read, that reaches
        // the existing `defer` path: refused pull, one retry scheduled, no
        // marker written, so the work stays due for the next launch.
        if (accountId == null || settled || confirmedFree) {
            // oxlint-disable-next-line react/set-state-in-effect -- one arm of an async state machine whose other arms settle from awaits; splitting this one out to a derivation would leave the status written from two places.
            setStatus("settled");
            return;
        }
        let cancelled = false;
        if (retryByAccount.current?.accountId !== accountId) {
            retryByAccount.current = { accountId, inFlight: null, retry: createSingleAdoptionRetry() };
        }
        const slot = retryByAccount.current;
        const { retry } = slot;
        setStatus("resolving");
        setFailed(false);

        const runReconcile = async (): Promise<AdoptionStatus> => {
            try {
                await prepareAccountAdoption(db, accountId);
                const engine = adoptionEngine(db);
                const remote = engine ? await engine.accountLedger() : "unknown";
                const plan = adoptionPlan(await localLedgerState(db), remote);
                if (plan === "ask") {
                    return "ask";
                }
                if (plan === "defer") {
                    retry.schedule();
                    return "settled";
                }
                const actions = adoptionActions(plan);
                if (actions) {
                    await completeAdoption(db, engine, actions, accountId);
                }
                return "settled";
            } catch (error: unknown) {
                console.warn("[outlayr] ledger adoption deferred", error);
                retry.schedule();
                return "settled";
            }
        };

        const reconcile = async () => {
            slot.inFlight ??= runReconcile().finally(() => {
                slot.inFlight = null;
            });
            const outcome = await slot.inFlight;
            if (!cancelled) {
                setStatus(outcome);
            }
        };

        reconcile();
        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                retry.run(reconcile);
            }
        });

        return () => {
            cancelled = true;
            subscription.remove();
        };
    }, [db, accountId, settled, confirmedFree, entitlementPending]);

    const choose = useCallback(
        (choice: AdoptionChoice) => {
            if (accountId == null) {
                return;
            }
            setStatus("working");
            setFailed(false);
            const adopt = async () => {
                await completeAdoption(db, adoptionEngine(db), choiceActions(choice), accountId);
                setStatus("settled");
            };

            adopt().catch((cause: unknown) => {
                console.warn("[outlayr] ledger adoption failed", cause);
                setFailed(true);
                setStatus("ask");
            });
        },
        [db, accountId]
    );

    const value = useMemo(() => ({ choose, failed, status }), [status, failed, choose]);

    return <LedgerAdoptionContext.Provider value={value}>{children}</LedgerAdoptionContext.Provider>;
}
