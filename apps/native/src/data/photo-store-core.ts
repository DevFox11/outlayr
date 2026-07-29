import { eq, isNotNull } from "drizzle-orm";
import { transactions } from "@/db/schema";
import type { SpendDb } from "./budget-spent";

/** Subfolder of the app's document directory that owns transaction photos. */
export const PHOTO_DIRECTORY = "transaction-photos";

/**
 * How long a file is spared from the orphan purge. A photo is written the moment
 * it is picked but only referenced when the form is saved, so a purge with no
 * grace would delete the picture out from under an open editor.
 */
export const PHOTO_PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface StoredPhoto {
	name: string;
	/** Milliseconds since the epoch. */
	modifiedAt: number;
}

/**
 * The filesystem seam. Injected so the reconciliation below stays free of
 * `expo-file-system`, which cannot load under the node test runner.
 */
export interface PhotoFiles {
	/** Absolute uri of the photo directory, which the implementation creates. */
	readonly directoryUri: string;
	list(): StoredPhoto[];
	remove(name: string): void;
	/**
	 * Copies an outside file in under `name`, answering whether it could. False
	 * means the source is already gone — the picker's cache is reclaimable at any
	 * time, which is the whole reason photos are copied out of it.
	 */
	adopt(sourceUri: string, name: string): boolean;
}

export function photoFileName(uri: string): string {
	const path = uri.split("?")[0].split("#")[0];
	return path.slice(path.lastIndexOf("/") + 1);
}

export function photoUriFor(directoryUri: string, name: string): string {
	return `${directoryUri.replace(/\/+$/, "")}/${name}`;
}

const DEFAULT_EXTENSION = ".jpg";
/** Longer than this is not an extension, it is the rest of a filename. */
const MAX_EXTENSION_LENGTH = 6;

export function photoExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	if (dot <= 0) {
		return DEFAULT_EXTENSION;
	}
	const extension = name.slice(dot).toLowerCase();
	return extension.length <= MAX_EXTENSION_LENGTH
		? extension
		: DEFAULT_EXTENSION;
}

export interface PhotoReconciliation {
	/** Rows whose photo was found under a stale absolute path. */
	repointed: number;
	/** Rows whose photo was still readable outside the store and was copied in. */
	rescued: number;
	/** Rows whose photo could not be found anywhere. */
	cleared: number;
	/** Files no row references any more. */
	purged: number;
}

/**
 * Reconciles the photo directory against the ledger, and answers what it moved.
 *
 * Two defects make this necessary rather than merely tidy. Rows written before
 * photos were copied out of the picker point into a cache iOS may reclaim at any
 * moment; and the document directory's absolute path contains a container UUID
 * that changes when the app is updated, so every stored uri goes stale at once.
 * Both are repaired by matching on the file name rather than trusting the path.
 *
 * Tombstoned rows are deliberately not excluded: the undo window can restore one,
 * and a purge that ignored them would take its photo first.
 *
 * Idempotent.
 */
export async function reconcilePhotos(
	db: SpendDb,
	files: PhotoFiles,
	nowMs: number,
): Promise<PhotoReconciliation> {
	const { directoryUri } = files;
	const stored = new Map(
		files.list().map((photo) => [photo.name, photo.modifiedAt]),
	);
	const rows = await db
		.select({ id: transactions.id, imageUri: transactions.imageUri })
		.from(transactions)
		.where(isNotNull(transactions.imageUri));

	const result: PhotoReconciliation = {
		repointed: 0,
		rescued: 0,
		cleared: 0,
		purged: 0,
	};
	const referenced = new Set<string>();

	for (const row of rows) {
		const uri = row.imageUri;
		if (uri == null) {
			continue;
		}

		const name = photoFileName(uri);
		if (name !== "" && stored.has(name)) {
			referenced.add(name);
			const current = photoUriFor(directoryUri, name);
			if (uri !== current) {
				await db
					.update(transactions)
					.set({ imageUri: current })
					.where(eq(transactions.id, row.id));
				result.repointed += 1;
			}
			continue;
		}

		const adopted = `${row.id}${photoExtension(name)}`;
		if (files.adopt(uri, adopted)) {
			stored.set(adopted, nowMs);
			referenced.add(adopted);
			await db
				.update(transactions)
				.set({ imageUri: photoUriFor(directoryUri, adopted) })
				.where(eq(transactions.id, row.id));
			result.rescued += 1;
			continue;
		}

		await db
			.update(transactions)
			.set({ imageUri: null })
			.where(eq(transactions.id, row.id));
		result.cleared += 1;
	}

	for (const [name, modifiedAt] of stored) {
		if (referenced.has(name) || nowMs - modifiedAt < PHOTO_PURGE_GRACE_MS) {
			continue;
		}
		files.remove(name);
		result.purged += 1;
	}

	return result;
}
