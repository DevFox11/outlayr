import type { Database } from "@/db/client";
import { clearStoredPhotos } from "@/lib/photo-storage";
import { clearSpotlight } from "@/lib/spotlight";
import { type EraseScope, eraseLedger } from "./erase-core";

export type { EraseScope };

/**
 * The Spotlight index lives in the system's store rather than the database, so
 * nothing in {@link eraseLedger} would touch it. Both scopes clear it; it is
 * rebuilt from whatever survives on the next open or background. Transaction
 * photos are files for the same reason, and the tombstones no longer name them.
 */
export async function eraseData(
	db: Database,
	scope: EraseScope,
): Promise<void> {
	await eraseLedger(db, scope);
	clearStoredPhotos();
	await clearSpotlight();
}
