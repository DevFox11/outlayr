import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { Database } from "@/db/client";
import {
	backfillAllRecurring,
	repairOrphanedRecurrence,
} from "./recurrence-backfill";

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
 *
 * `onSwept` runs after the walk commits. Anything derived from a chain's next
 * landing has to wait for that: the sweep retires the carrier and creates the
 * next occurrence, so a reader that fires on the same foreground event races it
 * and sees a landing the sweep is about to invalidate.
 */
export function useRecurrenceSweep(
	db: Database | null,
	onSwept?: (db: Database) => void,
): void {
	const lastSweepAt = useRef(0);
	// Read through a ref so a caller passing an inline closure does not re-arm the
	// AppState listener on every render.
	const swept = useRef(onSwept);
	swept.current = onSwept;

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
			// Repair first so a chain reinstated on this launch is swept on it too.
			repairOrphanedRecurrence(db)
				.then(() => backfillAllRecurring(db))
				.then(() => {
					swept.current?.(db);
				})
				.catch((error) => {
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
