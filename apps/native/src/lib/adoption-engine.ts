import type { AdoptionEngine } from "@/data/ledger-adoption";

/**
 * The seam #164 (push) and #165 (pull) fill. Reading the account's ledger,
 * refilling the local replica from seq 0, and tombstoning the account's rows are
 * all transport, and none of them exists yet — `packages/backend/convex/sync.ts`
 * still has to expose them.
 *
 * Null until then, which resolves every adoption to `defer`: no row on either
 * side is touched and no marker is written, so the reconciliation happens the
 * first time a build ships with an engine rather than being silently skipped.
 */
export function adoptionEngine(): AdoptionEngine | null {
	return null;
}
