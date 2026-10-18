import { Directory, File, Paths } from "expo-file-system";

const CACHE_DIRECTORY = "merchant-logos";
/** Written for a merchant that resolved to nothing, so the miss is remembered. */
const MISS_MARKER = ".miss";
/**
 * How long a miss is believed. A merchant can gain a logo, and a miss that
 * slipped through on a bad day must not brand a name forever.
 */
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The marker's file if it is still current; an expired one is removed on the way. */
function currentMiss(dir: Directory, key: string, now: number): File | null {
    const miss = new File(dir, `${key}${MISS_MARKER}`);
    if (!miss.exists) {
        return null;
    }
    const { modificationTime } = miss;
    if (modificationTime != null && now - modificationTime > MISS_TTL_MS) {
        miss.delete();
        return null;
    }
    return miss;
}

export type CachedLogo = { kind: "logo"; bytes: Uint8Array } | { kind: "miss" } | { kind: "unknown" };

function directory(): Directory {
    const dir = new Directory(Paths.cache, CACHE_DIRECTORY);
    if (!dir.exists) {
        dir.create({ intermediates: true });
    }
    return dir;
}

/**
 * The lookup key, not a filename the user ever sees — folded to letters and
 * digits so `Netflix`, `netflix` and `NETFLIX.COM` all land on one entry and
 * nothing can escape the directory.
 */
export function logoCacheKey(name: string, domain: string | null): string {
    const folded = `${name}|${domain ?? ""}`
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
        .replaceAll(/[^\p{L}\p{N}]+/gu, "");
    return folded.slice(0, 80);
}

/**
 * Lives in the cache directory rather than documents: these bytes are always
 * re-fetchable, so iOS is free to reclaim them under storage pressure, and
 * they never count against the user's own photo storage. A cached entry is
 * only ever an optimisation — a cleared cache costs one request.
 */
export async function readCachedLogo(key: string, now = Date.now()): Promise<CachedLogo> {
    if (key.length === 0) {
        return { kind: "unknown" };
    }
    try {
        if (currentMiss(directory(), key, now) != null) {
            return { kind: "miss" };
        }
        const hit = new File(directory(), key);
        if (hit.exists) {
            return { bytes: await hit.bytes(), kind: "logo" };
        }
    } catch {
        return { kind: "unknown" };
    }
    return { kind: "unknown" };
}

/**
 * The cached file's uri, readable synchronously so a list row can point an
 * `Image` straight at it. Cached-only by design: a missing entry answers null
 * rather than triggering a fetch.
 */
export function cachedLogoUri(key: string, now = Date.now()): string | null {
    if (key.length === 0) {
        return null;
    }
    try {
        const dir = directory();
        if (currentMiss(dir, key, now) != null) {
            return null;
        }
        const hit = new File(dir, key);
        return hit.exists ? hit.uri : null;
    } catch {
        return null;
    }
}

export function writeCachedLogo(key: string, bytes: Uint8Array | null): void {
    if (key.length === 0) {
        return;
    }
    try {
        const dir = directory();
        const target = new File(dir, bytes == null ? `${key}${MISS_MARKER}` : key);
        target.create({ overwrite: true });
        target.writeSync(bytes ?? new Uint8Array(0));
        // A logo found on a refreshed ask outranks the miss recorded before it;
        // the marker is read first, so left standing it would hide the file.
        if (bytes != null) {
            const stale = new File(dir, `${key}${MISS_MARKER}`);
            if (stale.exists) {
                stale.delete();
            }
        }
    } catch {
        // A cache that cannot be written is still a working feature.
    }
}

/** Every cached logo file; a remembered miss is not a logo and is left out. */
export function listCachedLogos(): File[] {
    try {
        return directory()
            .list()
            .filter((entry): entry is File => entry instanceof File && !entry.name.endsWith(MISS_MARKER));
    } catch {
        return [];
    }
}
