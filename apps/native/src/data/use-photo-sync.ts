import { getTableName } from "drizzle-orm";
import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";
import type { Database } from "@/db/client";
import { photoTransport } from "@/lib/convex";
import { photoFiles } from "@/lib/photo-storage";
import { debounce } from "@/lib/sync-cadence";
import { PHOTO_TABLES } from "./photo-store-core";
import { runPhotoSync } from "./photo-sync-core";
import { isSyncEnabled } from "./sync-outbox-core";
import { invalidateAll } from "./table-invalidation";

const PHOTO_TABLE_NAMES = PHOTO_TABLES.map((photoTable) => getTableName(photoTable.table));

/**
 * Longer than `useSyncEngine`'s: a photo pass moves whole files, and a burst of
 * edits that each touch one is far more expensive to chase than a burst of
 * record writes.
 */
const PHOTO_DEBOUNCE_MS = 5000;

/**
 * Moves photo bytes on the same shape as `useSyncEngine`, and deliberately as a
 * SEPARATE pass rather than a step inside it.
 *
 * A photo upload is one round trip per file against a different service; folded
 * into `runSync` a slow bucket would hold the record stream — and the record
 * stream is what every screen in the app reads. Splitting them means the ledger
 * still converges at its own pace while the pictures catch up behind it.
 *
 * Failures are swallowed to a warning for the same reason replication's are:
 * the photo is already durable on the device that took it.
 */
export function usePhotoSync(db: Database | null): void {
	useEffect(() => {
		if (db == null) {
			return;
		}
		const transport = photoTransport();

		let running = false;

		const cycle = async () => {
			if (running) {
				return;
			}
			running = true;
			try {
				if (!(await isSyncEnabled(db))) {
					return;
				}
				const { downloaded } = await runPhotoSync(db, photoFiles, transport);
				if (downloaded > 0) {
					// Only a download changes what a screen can draw; an upload records
					// a key nothing renders.
					invalidateAll(PHOTO_TABLE_NAMES);
				}
			} catch (error) {
				console.warn("[outlayr] photo sync failed", error);
			} finally {
				running = false;
			}
		};

		const schedule = debounce(PHOTO_DEBOUNCE_MS, () => {
			cycle();
		});

		cycle();

		const listener = addDatabaseChangeListener((event) => {
			if (PHOTO_TABLE_NAMES.includes(event.tableName)) {
				schedule.schedule();
			}
		});

		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				cycle();
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
