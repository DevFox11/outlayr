import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import type { Database } from "@/db/client";
import { isBehindWatermark } from "@/domain/sync-wakeup";
import { syncTransport, watchSyncWatermark } from "@/lib/convex";
import { debounce } from "@/lib/sync-cadence";
import { runSync } from "./sync-engine-core";
import { getSyncCursor, SYNCED_TABLES, setSyncedAt } from "./sync-outbox-core";
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
 * Mount, foreground and a local write all fire on something this handset did,
 * so on their own two phones side by side never see each other until one of them
 * is touched. A peer's push therefore arrives as a live watermark instead, and
 * that subscription is what makes replication realtime. The local triggers stay
 * as its fallback: a dropped socket degrades to catching up on the next
 * foreground rather than to not catching up at all.
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

		// The cursor is read at wake-up rather than remembered, because this
		// device's own push moves the watermark too: by the time the value arrives
		// the cycle that caused it may already have caught this handset up, and a
		// stale cursor would turn every local write into a second round trip.
		const wake = async (watermark: number) => {
			if (isBehindWatermark(watermark, await getSyncCursor(db))) {
				await cycle();
			}
		};

		const unwatch = watchSyncWatermark((watermark) => {
			void wake(watermark).catch((error) => {
				console.warn("[outlayr] sync wake-up failed", error);
			});
		});

		return () => {
			schedule.cancel();
			listener.remove();
			subscription.remove();
			unwatch?.();
		};
	}, [db]);
}
