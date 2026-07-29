import { eq } from "drizzle-orm";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useDatabase } from "@/contexts/local-data-context";
import { META_KEYS } from "@/data/app-meta-core";
import {
	localLedgerState,
	markAdopted,
	runAdoption,
} from "@/data/ledger-adoption";
import { useLiveQuery } from "@/data/live-query";
import { appMeta } from "@/db/schema";
import {
	type AdoptionChoice,
	adoptionActions,
	adoptionPlan,
	choiceActions,
} from "@/domain/ledger-adoption";
import { adoptionEngine } from "@/lib/adoption-engine";
import { useAuthSession } from "@/lib/auth-session";

export type AdoptionStatus = "resolving" | "settled" | "ask" | "working";

export interface LedgerAdoption {
	status: AdoptionStatus;
	failed: boolean;
	choose: (choice: AdoptionChoice) => void;
}

const SETTLED: LedgerAdoption = {
	status: "settled",
	failed: false,
	choose: () => {},
};

const LedgerAdoptionContext = createContext<LedgerAdoption>(SETTLED);

export function useLedgerAdoption(): LedgerAdoption {
	return useContext(LedgerAdoptionContext);
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
		db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.ledgerAdoption)),
	);
	const settled = accountId != null && (rows[0]?.value ?? null) === accountId;

	// Lazily, so the frame before the effect below runs is not a cover over an
	// app that had nothing to reconcile in the first place.
	const [status, setStatus] = useState<AdoptionStatus>(() =>
		accountId == null || settled ? "settled" : "resolving",
	);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (accountId == null || settled) {
			setStatus("settled");
			return;
		}
		let cancelled = false;
		setStatus("resolving");
		setFailed(false);

		void (async () => {
			try {
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
				const actions = adoptionActions(plan);
				if (actions) {
					await runAdoption(db, engine, actions);
					await markAdopted(db, accountId);
				}
				if (!cancelled) {
					setStatus("settled");
				}
			} catch (error) {
				console.warn("[outlayr] ledger adoption deferred", error);
				if (!cancelled) {
					setStatus("settled");
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [db, accountId, settled]);

	const choose = useCallback(
		(choice: AdoptionChoice) => {
			if (accountId == null) {
				return;
			}
			setStatus("working");
			setFailed(false);
			void (async () => {
				try {
					await runAdoption(db, adoptionEngine(db), choiceActions(choice));
					await markAdopted(db, accountId);
					setStatus("settled");
				} catch (error) {
					console.warn("[outlayr] ledger adoption failed", error);
					setFailed(true);
					setStatus("ask");
				}
			})();
		},
		[db, accountId],
	);

	const value = useMemo(
		() => ({ status, failed, choose }),
		[status, failed, choose],
	);

	return (
		<LedgerAdoptionContext.Provider value={value}>
			{children}
		</LedgerAdoptionContext.Provider>
	);
}
