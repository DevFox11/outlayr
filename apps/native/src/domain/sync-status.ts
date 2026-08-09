export interface SyncLabel {
	count?: number;
	key: "settings.sync.upToDate" | "settings.sync.never" | "settings.sync.pending" | "settings.sync.pendingOne";
}

/**
 * What the Settings sync row says.
 *
 * An empty queue reads "Up to date" rather than "0 waiting": both are true, and
 * only one of them answers what the user opened the row to ask. A device that
 * has never completed a cycle says so instead, because "up to date" on a ledger
 * the server has never seen is a lie the user cannot check.
 *
 * The pending count is the only failure signal, deliberately. §8.7 of
 * `docs/convex-sync-design.md` settles the UX as silent-and-retrying — a count
 * that stops falling is honest about what is true without guessing at why.
 */
export function syncStatusLabel(pending: number, syncedAt: Date | null): SyncLabel {
	if (pending === 1) {
		return { key: "settings.sync.pendingOne" };
	}
	if (pending > 1) {
		return { count: pending, key: "settings.sync.pending" };
	}
	return syncedAt === null ? { key: "settings.sync.never" } : { key: "settings.sync.upToDate" };
}
