import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { Database } from "@/db/client";
import { backfillAllRecurring } from "./recurrence-backfill";

const SWEEP_COOLDOWN_MS = 60_000;

/**
 * Advances every live subscription when the app opens and each time it returns
 * to the foreground. Runs at the provider rather than on the Log because the
 * generated rows feed Budgets and Insights too.
 *
 * The cooldown keeps a rapid app-switch from re-walking the whole table; a
 * failure clears it so the next foreground retries instead of waiting out a
 * window it never used.
 *
 * `db` is nullable so this can be called before the database is open — the
 * provider that owns the handle does not sit behind the splash gate.
 */
export function useRecurrenceSweep(db: Database | null): void {
	const lastSweepAt = useRef(0);

	useEffect(() => {
		if (db == null) {
			return;
		}

		const sweep = () => {
			const startedAt = Date.now();
			if (startedAt - lastSweepAt.current < SWEEP_COOLDOWN_MS) {
				return;
			}
			lastSweepAt.current = startedAt;
			backfillAllRecurring(db).catch((error) => {
				lastSweepAt.current = 0;
				console.error("Recurrence sweep failed", error);
			});
		};

		sweep();

		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				sweep();
			}
		});

		return () => {
			subscription.remove();
		};
	}, [db]);
}
