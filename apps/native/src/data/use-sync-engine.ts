import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import type { Database } from "@/db/client";
import { syncTransport } from "@/lib/convex";
import { debounce } from "@/lib/sync-cadence";
import { runSync } from "./sync-engine-core";
import { SYNCED_TABLES, setSyncedAt } from "./sync-outbox-core";
import { invalidateAll } from "./table-invalidation";

/**
 * A write is never blocked on the network, so a burst of edits settles before
 * anything is pushed. Longer than the widget cadence because a round trip is
 * far more expensive than rebuilding a tile.
 */
const SYNC_DEBOUNCE_MS = 2000;

const REPLICATED = new Set<string>(SYNCED_TABLES);

/**
 * Drives replication on the same shape as `useSystemSync`: on foreground, and
 * on a debounced local write. Never on the write path itself.
 *
 * Inert until the device has a backend AND the sync gate is on — the gate is
 * device-local and only the sign-in flow opens it, so a signed-out install runs
 * this hook and does nothing at all.
 *
 * Failures are swallowed to a warning by design. The app is local-first: a
 * failed sync is not a failed save, and surfacing it as an error trains the
 * user to distrust a ledger that is fine.
 */
export function useSyncEngine(db: Database | null): void {
	useEffect(() => {
		if (db == null) {
			return;
		}
		const transport = syncTransport();
		if (transport == null) {
			return;
		}

		let running = false;
		let queued = false;

		const cycle = async () => {
			if (running) {
				// A write that lands mid-cycle is not lost: it is queued in the outbox
				// and this re-runs once for however many arrived.
				queued = true;
				return;
			}
			running = true;
			try {
				do {
					queued = false;
					const { tables } = await runSync(db, transport);
					// Outside the write transaction, so nothing repaints against rows a
					// rollback is about to remove.
					invalidateAll(tables);
				} while (queued);
				// Only on a clean pass. A cycle that threw reached the server or did
				// not, and claiming a time for it would date a sync that never landed.
				await setSyncedAt(db, new Date());
				invalidateAll(["appMeta"]);
			} catch (error) {
				console.warn("[outlayr] sync failed", error);
			} finally {
				running = false;
			}
		};

		const schedule = debounce(SYNC_DEBOUNCE_MS, () => {
			void cycle();
		});

		void cycle();

		const listener = addDatabaseChangeListener((event) => {
			if (REPLICATED.has(event.tableName)) {
				schedule.schedule();
			}
		});

		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				void cycle();
			} else if (state === "background") {
				schedule.cancel();
			}
		});

		return () => {
			schedule.cancel();
			listener.remove();
			subscription.remove();
		};
	}, [db]);
}
