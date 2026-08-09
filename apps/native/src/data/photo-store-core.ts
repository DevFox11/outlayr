import { eq, isNotNull } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { accounts, transactions } from "@/db/schema";
import type { SpendDb } from "./budget-spent";

/** Subfolder of the app's document directory that owns transaction photos. */
export const PHOTO_DIRECTORY = "transaction-photos";

export interface PhotoTable {
	readonly id: AnySQLiteColumn;
	readonly imageKey: AnySQLiteColumn;
	readonly imageUri: AnySQLiteColumn;
	readonly table: SQLiteTable;
}

/**
 * Every table that names a photo.
 *
 * One directory holds all of them — an account logo is persisted by the same
 * `persistPickedPhoto` a receipt is — so a walk that misses a table reads its
 * files as orphans and purges them. `transactionPhotos` joins the list when
 * something starts writing it.
 */
export const PHOTO_TABLES: readonly PhotoTable[] = [
	{
		id: transactions.id,
		imageKey: transactions.imageKey,
		imageUri: transactions.imageUri,
		table: transactions,
	},
	{
		id: accounts.id,
		imageKey: accounts.imageKey,
		imageUri: accounts.imageUri,
		table: accounts,
	},
];

/**
 * How long a file is spared from the orphan purge. A photo is written the moment
 * it is picked but only referenced when the form is saved, so a purge with no
 * grace would delete the picture out from under an open editor.
 */
export const PHOTO_PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface StoredPhoto {
	/** Milliseconds since the epoch. */
	modifiedAt: number;
	name: string;
}

/**
 * The filesystem seam. Injected so the reconciliation below stays free of
 * `expo-file-system`, which cannot load under the node test runner.
 */
export interface PhotoFiles {
	/**
	 * Copies an outside file in under `name`, answering whether it could. False
	 * means the source is already gone — the picker's cache is reclaimable at any
	 * time, which is the whole reason photos are copied out of it.
	 */
	adopt: (sourceUri: string, name: string) => boolean;
	/** Absolute uri of the photo directory, which the implementation creates. */
	readonly directoryUri: string;
	list: () => StoredPhoto[];
	/** Null when the file is gone, which is not an error — see {@link adopt}. */
	read: (name: string) => Uint8Array | null;
	remove: (name: string) => void;
	write: (name: string, bytes: Uint8Array) => void;
}

const TRAILING_SLASHES = /\/+$/;

export function photoFileName(uri: string): string {
	const [beforeQuery] = uri.split("?");
	const [path] = beforeQuery.split("#");
	return path.slice(path.lastIndexOf("/") + 1);
}

export function photoUriFor(directoryUri: string, name: string): string {
	return `${directoryUri.replace(TRAILING_SLASHES, "")}/${name}`;
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
	return extension.length <= MAX_EXTENSION_LENGTH ? extension : DEFAULT_EXTENSION;
}

export interface PhotoReconciliation {
	/** Rows whose photo could not be found anywhere. */
	cleared: number;
	/** Files no row references any more. */
	purged: number;
	/** Rows whose photo was found under a stale absolute path. */
	repointed: number;
	/** Rows whose photo was still readable outside the store and was copied in. */
	rescued: number;
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
export async function reconcilePhotos(db: SpendDb, files: PhotoFiles, nowMs: number): Promise<PhotoReconciliation> {
	const { directoryUri } = files;
	const stored = new Map(files.list().map((photo) => [photo.name, photo.modifiedAt]));

	const result: PhotoReconciliation = {
		cleared: 0,
		purged: 0,
		repointed: 0,
		rescued: 0,
	};
	const referenced = new Set<string>();

	for (const photoTable of PHOTO_TABLES) {
		// biome-ignore lint/performance/noAwaitInLoops: every table reconciles against the `stored` and `referenced` maps the previous table already mutated, so a table's rows cannot be read before the one before it has finished adopting files
		const rows = (await db
			.select({ id: photoTable.id, imageUri: photoTable.imageUri })
			.from(photoTable.table)
			.where(isNotNull(photoTable.imageUri))) as {
			id: string;
			imageUri: string | null;
		}[];

		const repoint = async (id: string, uri: string | null) =>
			await db.update(photoTable.table).set({ imageUri: uri }).where(eq(photoTable.id, id));

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
					// biome-ignore lint/performance/noAwaitInLoops: two rows can name one file, so a row's `stored`/`referenced` bookkeeping and its adopt must land before the next row asks whether that file exists
					await repoint(row.id, current);
					result.repointed += 1;
				}
				continue;
			}

			const adopted = `${row.id}${photoExtension(name)}`;
			if (files.adopt(uri, adopted)) {
				stored.set(adopted, nowMs);
				referenced.add(adopted);
				await repoint(row.id, photoUriFor(directoryUri, adopted));
				result.rescued += 1;
				continue;
			}

			await repoint(row.id, null);
			result.cleared += 1;
		}
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
