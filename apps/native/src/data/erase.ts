import type { Database } from "@/db/client";
import { type EraseScope, eraseLedger } from "./erase-core";

export type { EraseScope };

/**
 * The two stores an erase has to clear outside the database. Injected so this
 * sequencing stays free of `expo-file-system` and `expo-core-spotlight`, neither
 * of which can load under the node test runner.
 */
export interface EraseResidue {
	clearSpotlight(): Promise<void>;
	clearStoredPhotos(): void;
}

/**
 * The Spotlight index lives in the system's store rather than the database, so
 * nothing in {@link eraseLedger} would touch it. Both scopes clear it; it is
 * rebuilt from whatever survives on the next open or background. Transaction
 * photos are files for the same reason, and the tombstones no longer name them.
 *
 * The three steps cannot be made one transaction, so the caller is told when
 * only some of them ran. Spotlight is cleared even when the photo directory
 * refuses to go: an index nobody rebuilt keeps erased notes and amounts
 * answering device-wide search, which is a worse residue than files no surviving
 * row names. The photo failure is rethrown afterwards so the screen reports a
 * partial erase rather than confirming a clean one.
 */
export async function eraseData(db: Database, scope: EraseScope, residue: EraseResidue): Promise<void> {
	await eraseLedger(db, scope);

	// Boxed rather than kept as `unknown`: a thrown `undefined` is still a failure.
	let photoFailure: { cause: unknown } | null = null;
	try {
		residue.clearStoredPhotos();
	} catch (cause) {
		photoFailure = { cause };
	}

	await residue.clearSpotlight();

	if (photoFailure) {
		throw photoFailure.cause;
	}
}
