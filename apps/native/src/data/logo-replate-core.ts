import { eq, isNotNull } from "drizzle-orm";

import { accounts, transactions } from "@/db/schema";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import type { SpendDb } from "./budget-spent";

/** A logo the fetch cache still holds that a plate would now change. */
export interface CachedOriginal {
    bytes: Uint8Array;
    /** What a copy stored before plates looks like, from `blackBakedSignature`. */
    signature: Uint8Array;
}

export interface LogoReplateDeps {
    /** The cached logos filed under this merchant name, closest match first. */
    originalsFor: (name: string) => Promise<readonly CachedOriginal[]>;
    /** Stores the original again, now on its plate, and answers the new uri. */
    persist: (bytes: Uint8Array) => Promise<string>;
    /** A stored photo's signature, null when it cannot be read. */
    signature: (uri: string) => Promise<Uint8Array | null>;
}

/** Mean per-channel difference two signatures can show and still be one image re-encoded. */
const SIGNATURE_TOLERANCE = 6;

function sameImage(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let total = 0;
    for (const [index, value] of a.entries()) {
        total += Math.abs(value - b[index]);
    }
    return total / a.length <= SIGNATURE_TOLERANCE;
}

const TABLES = [
    { imageUri: transactions.imageUri, name: transactions.note, table: transactions },
    { imageUri: accounts.imageUri, name: accounts.name, table: accounts },
] as const;

/**
 * Re-stores, once per device, the logos saved before logos had a plate. Their
 * see-through pixels were baked black into the JPEG and cannot be recovered
 * from the file, but the original bytes are usually still in the logo cache.
 *
 * A stored photo is only replaced when both hold: its row's name files a
 * cached logo, and the photo looks exactly like that logo drawn over black.
 * Neither is enough alone: a receipt on a Netflix row passes the first, and
 * a dark photo passes the second against any black mark like Apple's.
 *
 * shortcut: a row whose name differs from the one the logo was fetched under,
 * or whose cache entry iOS has reclaimed, keeps its black tile; re-resolve the
 * merchant's domain if that turns out common.
 */
export async function replateStoredLogos(db: SpendDb, deps: LogoReplateDeps): Promise<number> {
    if ((await getMeta(db, META_KEYS.logoPlates)) != null) {
        return 0;
    }

    const signatures = new Map<string, Uint8Array | null>();
    const replaced = new Map<string, string>();

    const replacement = async (uri: string, name: string): Promise<string | null> => {
        if (!signatures.has(uri)) {
            signatures.set(uri, await deps.signature(uri));
        }
        const stored = signatures.get(uri);
        if (stored == null) {
            return null;
        }
        const originals = await deps.originalsFor(name);
        const original = originals.find((candidate) => sameImage(candidate.signature, stored));
        return original == null ? null : await deps.persist(original.bytes);
    };

    /* oxlint-disable no-await-in-loop -- rows sharing a photo must see the replacement the first of them stored, or each would store its own copy */
    for (const { imageUri, name, table } of TABLES) {
        const rows = await db.selectDistinct({ imageUri, name }).from(table).where(isNotNull(imageUri));
        for (const row of rows) {
            const uri = row.imageUri;
            if (uri == null) {
                continue;
            }
            const next = replaced.get(uri) ?? (await replacement(uri, row.name));
            if (next == null) {
                continue;
            }
            replaced.set(uri, next);
            await db.update(table).set({ imageUri: next }).where(eq(imageUri, uri));
        }
    }
    /* oxlint-enable no-await-in-loop */

    await setMeta(db, META_KEYS.logoPlates, "1");
    return replaced.size;
}
