import { and, eq, isNotNull, isNull } from "drizzle-orm";

import type { SpendDb } from "./budget-spent";
import { PHOTO_TABLES, photoFileName, photoUriFor } from "./photo-store-core";
import type { PhotoFiles, PhotoTable } from "./photo-store-core";

/**
 * The bytes half of replication.
 *
 * `sync-engine-core.ts` moves small records through one merge-sorted stream; a
 * JPEG cannot travel that way, so a photo splits in two. The *key* replicates as
 * an ordinary column on the row that names it — see {@link PHOTO_TABLES} — and
 * converges by the same last-write-wins rule as everything else. The *bytes* go
 * device→R2→device over signed urls that this module mints, uses and discards.
 *
 * The two halves are not transactional with each other and cannot be, so every
 * order here is chosen for which half is safe to be missing:
 *
 * - Bytes land BEFORE the key is recorded. A key naming an object that was
 *   never PUT is a photo every device fails to fetch forever; bytes with no key
 *   are storage nobody is charged for yet and the next pass re-uses them.
 * - The key is recorded BEFORE the local path on the receiving device, because
 *   the path is device-local and derivable from the key, never the reverse.
 *
 * Both passes are idempotent and safe to interrupt at any await.
 */
export interface PhotoTransport {
    /**
     * Records an object whose PUT completed. `storageId` is what Convex file
     * storage hands back from the PUT; R2 addresses by key and returns none.
     */
    confirmUpload: (key: string, storageId: string | null) => Promise<void>;
    /**
     * Null for an object that is not there. A 404 is the expected outcome of a
     * delete racing this fetch, not a failure — see {@link downloadPhotos}.
     */
    get: (url: string) => Promise<Uint8Array | null>;
    /** The storage id when the backend allocates one, null when the key is the address. */
    put: (url: string, bytes: Uint8Array) => Promise<string | null>;
    /** Short-lived signed GETs. A key the account does not own is not returned. */
    readUrls: (keys: readonly string[]) => Promise<{ key: string; url: string }[]>;
    /** Frees an object no row in the account names any more. */
    release: (key: string) => Promise<void>;
    /** Answers a signed PUT and the key to record once the bytes are up. */
    requestUpload: (name: string) => Promise<{ key: string; url: string }>;
}

/**
 * Photos moved per pass, each direction. Kept at or under the server's
 * `PHOTO_URL_BATCH_LIMIT`, and small because a pass runs on the foreground app:
 * a backlog drains over several passes rather than holding the connection.
 */
export const PHOTO_SYNC_BATCH = 25;

export interface PhotoSyncResult {
    downloaded: number;
    /** Objects freed because the row that named them now names a different one. */
    released: number;
    uploaded: number;
}

/** The device file name a key was minted from, or null if it is malformed. */
export function photoNameFromKey(key: string): string | null {
    const segments = key.split("/");
    const name = segments.at(-1);
    return segments.length >= 2 && name ? name : null;
}

/**
 * Whether `imageKey` still names the photo `imageUri` points at.
 *
 * The key's last segment IS the device file name, which is what makes the
 * comparison possible without storing a second column. It is also what makes a
 * retried upload land on the same key instead of orphaning bytes.
 */
function keyMatchesPhoto(imageKey: string | null, imageUri: string): boolean {
    return imageKey !== null && photoNameFromKey(imageKey) === photoFileName(imageUri);
}

interface PhotoRow {
    id: string;
    imageKey: string | null;
    imageUri: string | null;
}

async function photoRows(
    db: SpendDb,
    photoTable: PhotoTable,
    live: "uploadable" | "downloadable"
): Promise<PhotoRow[]> {
    // SAFETY: as in `photo-store-core` — a runtime table choice erases the
    // generated row type, and the selected columns are common to every one.
    return (await db
        .select({
            id: photoTable.id,
            imageKey: photoTable.imageKey,
            imageUri: photoTable.imageUri,
        })
        .from(photoTable.table)
        .where(
            live === "uploadable"
                ? isNotNull(photoTable.imageUri)
                : and(isNotNull(photoTable.imageKey), isNull(photoTable.imageUri))
        )) as PhotoRow[];
}

/**
 * Sends up every photo this device holds that the account does not.
 *
 * A row whose key no longer matches its path is a replaced photo: the new bytes
 * go up and the old object is released, which is the one deletion a device can
 * drive without guessing — it still holds the superseded key at that moment.
 * Releasing is best-effort and never fails the upload, because the server
 * re-checks references anyway and a leaked object costs storage where a lost
 * one costs a photo.
 *
 * `updatedAt` is bumped with the key, deliberately. The row genuinely changed —
 * its photo became durable for the whole account — and letting it lose a merge
 * to an older peer edit would strand the bytes with nothing naming them.
 */
export async function uploadPhotos(
    db: SpendDb,
    files: PhotoFiles,
    transport: PhotoTransport,
    now: Date
): Promise<{ uploaded: number; released: number }> {
    let uploaded = 0;
    let released = 0;

    for (const photoTable of PHOTO_TABLES) {
        /* oxlint-disable no-await-in-loop -- PHOTO_SYNC_BATCH caps the pass by counting uploads that have already finished, so each photo's request/put/confirm handshake has to complete before the next row is considered — running them together would send the whole ledger's photos in one pass */
        for (const row of await photoRows(db, photoTable, "uploadable")) {
            if (uploaded >= PHOTO_SYNC_BATCH) {
                return { released, uploaded };
            }
            const uri = row.imageUri;
            if (uri === null || keyMatchesPhoto(row.imageKey, uri)) {
                continue;
            }

            const name = photoFileName(uri);
            const bytes = files.read(name);
            if (name === "" || bytes === null) {
                // The launch reconciliation owns "the file is not where the row says";
                // re-pointing it here would duplicate that logic against a stale read.
                continue;
            }

            const superseded = row.imageKey;
            const { key, url } = await transport.requestUpload(name);
            const storageId = await transport.put(url, bytes);
            await transport.confirmUpload(key, storageId);

            await db
                .update(photoTable.table)
                .set({ imageKey: key, updatedAt: now })
                // A photo replaced while the bytes were in flight must not be labelled
                // with the key of the one that just went up.
                .where(and(eq(photoTable.id, row.id), eq(photoTable.imageUri, uri)));
            uploaded += 1;

            if (superseded !== null && superseded !== key) {
                try {
                    await transport.release(superseded);
                    released += 1;
                } catch {
                    // Leaked, not lost. A later server-side sweep reclaims it.
                }
            }
        }
        /* oxlint-enable no-await-in-loop */
    }

    return { released, uploaded };
}

/**
 * Fetches the bytes for keys this device has a row for but no file.
 *
 * The window this closes is the ordinary one: `seq` order delivers a row long
 * before a pass gets to its photo, so between the two the transaction renders
 * through the identity tile's existing "no readable photo" path. Nothing new is
 * shown for the gap and nothing needs to know it is a gap.
 *
 * A url that answers nothing is the delete race and is treated as the same
 * state: the key stays on the row, no file appears, and the next pass tries
 * again. Clearing the key here would turn a transient 404 into permanent data
 * loss the moment two devices disagreed about a delete.
 */
export async function downloadPhotos(db: SpendDb, files: PhotoFiles, transport: PhotoTransport): Promise<number> {
    const wanted = new Map<string, { photoTable: PhotoTable; id: string; name: string }[]>();
    const onDisk = new Set(files.list().map((photo) => photo.name));
    let downloaded = 0;

    const repoint = async (photoTable: PhotoTable, id: string, name: string) => {
        await db
            .update(photoTable.table)
            // No `updatedAt` bump: the path is this handset's business and does not
            // replicate, so presenting it as an edit would burn a sequence number on
            // every other device for nothing.
            .set({ imageUri: photoUriFor(files.directoryUri, name) })
            .where(eq(photoTable.id, id));
    };

    /* oxlint-disable no-await-in-loop -- each table is read and repointed on the one SQLite connection the pass is still walking, so issuing the tables together interleaves writes into the middle of a read */
    for (const photoTable of PHOTO_TABLES) {
        for (const row of await photoRows(db, photoTable, "downloadable")) {
            const key = row.imageKey;
            const name = key === null ? null : photoNameFromKey(key);
            if (key === null || name === null) {
                continue;
            }
            if (onDisk.has(name)) {
                // Already here — the file survived while the path did not, or a sibling
                // row shares the photo. Nothing to fetch.
                await repoint(photoTable, row.id, name);
                continue;
            }
            const bucket = wanted.get(key) ?? [];
            bucket.push({ id: row.id, name, photoTable });
            wanted.set(key, bucket);
        }
    }
    /* oxlint-enable no-await-in-loop */

    const keys = [...wanted.keys()].slice(0, PHOTO_SYNC_BATCH);
    if (keys.length === 0) {
        return 0;
    }

    /* oxlint-disable no-await-in-loop -- `get` holds a whole photo's bytes in memory until they are written out, so fetching the batch together would hold PHOTO_SYNC_BATCH photos at once on a handset */
    for (const { key, url } of await transport.readUrls(keys)) {
        const bytes = await transport.get(url);
        if (bytes === null) {
            continue;
        }
        /* oxlint-disable no-await-in-loop -- these updates share the one SQLite connection the loop keeps downloading against, so issuing them together interleaves the writes with the next photo's fetch */
        for (const { photoTable, id, name } of wanted.get(key) ?? []) {
            files.write(name, bytes);
            await repoint(photoTable, id, name);
            downloaded += 1;
        }
        /* oxlint-enable no-await-in-loop */
    }
    /* oxlint-enable no-await-in-loop */

    return downloaded;
}

/**
 * One photo replication cycle. Upload first, for the same reason `runSync`
 * pushes first: bytes this device owns should reach the account before it
 * spends the pass fetching a peer's.
 */
export async function runPhotoSync(
    db: SpendDb,
    files: PhotoFiles,
    transport: PhotoTransport,
    now: Date = new Date()
): Promise<PhotoSyncResult> {
    const { uploaded, released } = await uploadPhotos(db, files, transport, now);
    const downloaded = await downloadPhotos(db, files, transport);
    return { downloaded, released, uploaded };
}
