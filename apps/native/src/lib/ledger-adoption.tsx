import { eq } from "drizzle-orm";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useDatabase } from "@/contexts/local-data-context";
import { createSingleAdoptionRetry } from "@/data/adoption-retry";
import { META_KEYS } from "@/data/app-meta-core";
import { completeAdoption, localLedgerState, prepareAccountAdoption } from "@/data/ledger-adoption";
import { useLiveQuery } from "@/data/live-query";
import { appMeta } from "@/db/schema";
import { type AdoptionChoice, adoptionActions, adoptionPlan, choiceActions } from "@/domain/ledger-adoption";
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
	const rows = useLiveQuery(appMeta, () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.ledgerAdoption)));
	const settled = accountId != null && (rows[0]?.value ?? null) === accountId;

	// Lazily, so the frame before the effect below runs is not a cover over an
	// app that had nothing to reconcile in the first place.
	const [status, setStatus] = useState<AdoptionStatus>(() => (accountId == null || settled ? "settled" : "resolving"));
	const [failed, setFailed] = useState(false);
	const retryByAccount = useRef<{ accountId: string; retry: ReturnType<typeof createSingleAdoptionRetry> } | null>(
		null
	);

	useEffect(() => {
		if (accountId == null || settled) {
			setStatus("settled");
			return;
		}
		let cancelled = false;
		if (retryByAccount.current?.accountId !== accountId) {
			retryByAccount.current = { accountId, retry: createSingleAdoptionRetry() };
		}
		const { retry } = retryByAccount.current;
		setStatus("resolving");
		setFailed(false);

		const reconcile = async () => {
			try {
				await prepareAccountAdoption(db, accountId);
				const engine = adoptionEngine(db);
				const remote = engine ? await engine.accountLedger() : "unknown";
				const plan = adoptionPlan(await localLedgerState(db), remote);
				if (cancelled) {
					return;
				}
				if (plan === "ask") {
					setStatus("ask");
					return;
				}
				if (plan === "defer") {
					retry.schedule();
					setStatus("settled");
					return;
				}
				const actions = adoptionActions(plan);
				if (actions) {
					await completeAdoption(db, engine, actions, accountId);
				}
				if (!cancelled) {
					setStatus("settled");
				}
			} catch (error: unknown) {
				console.warn("[outlayr] ledger adoption deferred", error);
				retry.schedule();
				if (!cancelled) {
					setStatus("settled");
				}
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
	}, [db, accountId, settled]);

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

			adopt().catch((error: unknown) => {
				console.warn("[outlayr] ledger adoption failed", error);
				setFailed(true);
				setStatus("ask");
			});
		},
		[db, accountId]
	);

	const value = useMemo(() => ({ choose, failed, status }), [status, failed, choose]);

	return <LedgerAdoptionContext.Provider value={value}>{children}</LedgerAdoptionContext.Provider>;
}
