import { count } from "drizzle-orm";
import type { Database } from "@/db/client";
import { appMeta, outbox } from "@/db/schema";
import { META_KEYS } from "./app-meta-core";
import { useLiveQuery } from "./live-query";

export interface SyncStatus {
	/** Rows this device has queued and not yet handed to the server. */
	pending: number;
	/** When a cycle last completed here, or null if none ever has. */
	syncedAt: Date | null;
}

/**
 * What the Settings row reads.
 *
 * Deliberately carries no error state. §8.7 of `docs/convex-sync-design.md`
 * settles the failure UX as silent-and-retrying: the app is local-first, a
 * failed sync is not a failed save, and surfacing a transient network blip here
 * trains the user to distrust a ledger that is fine. A stalled queue shows as a
 * pending count that stops falling, which says what is true without claiming to
 * know why.
 */
export function useSyncStatus(db: Database): SyncStatus {
	const pendingRows = useLiveQuery(outbox, () =>
		db.select({ total: count() }).from(outbox),
	);
	const metaRows = useLiveQuery(appMeta, () => db.select().from(appMeta));

	const raw = metaRows.find((row) => row.key === META_KEYS.syncedAt)?.value;
	const ms = raw == null ? Number.NaN : Number(raw);

	return {
		pending: pendingRows[0]?.total ?? 0,
		syncedAt: Number.isFinite(ms) ? new Date(ms) : null,
	};
}
