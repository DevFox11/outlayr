import { Directory, File, Paths } from "expo-file-system";

const CACHE_DIRECTORY = "merchant-logos";
/** Written for a merchant that resolved to nothing, so the miss is remembered. */
const MISS_MARKER = ".miss";

export type CachedLogo =
	| { kind: "logo"; bytes: Uint8Array }
	| { kind: "miss" }
	| { kind: "unknown" };

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
 *
 * `logoKey` folds in the shared-cache object key when one is known, so a
 * merchant whose stored image changed (a new `logoKey` after re-resolution)
 * lands on a fresh on-device entry instead of serving the stale bytes under
 * the old one forever.
 */
export function logoCacheKey(
	name: string,
	domain: string | null,
	logoKey?: string | null,
): string {
	const folded = `${name}|${domain ?? ""}|${logoKey ?? ""}`
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");
	return folded.slice(0, 80);
}

/**
 * Lives in the cache directory rather than documents: these bytes are always
 * re-fetchable, so iOS is free to reclaim them under storage pressure, and
 * they never count against the user's own photo storage. A cached entry is
 * only ever an optimisation — a cleared cache costs one request.
 */
export async function readCachedLogo(key: string): Promise<CachedLogo> {
	if (key.length === 0) {
		return { kind: "unknown" };
	}
	try {
		const miss = new File(directory(), `${key}${MISS_MARKER}`);
		if (miss.exists) {
			return { kind: "miss" };
		}
		const hit = new File(directory(), key);
		if (hit.exists) {
			return { kind: "logo", bytes: await hit.bytes() };
		}
	} catch {
		return { kind: "unknown" };
	}
	return { kind: "unknown" };
}

export function writeCachedLogo(key: string, bytes: Uint8Array | null): void {
	if (key.length === 0) {
		return;
	}
	try {
		const target = new File(
			directory(),
			bytes == null ? `${key}${MISS_MARKER}` : key,
		);
		target.create({ overwrite: true });
		target.write(bytes ?? new Uint8Array(0));
	} catch {
		// A cache that cannot be written is still a working feature.
	}
}

export function clearLogoCache(): void {
	const dir = new Directory(Paths.cache, CACHE_DIRECTORY);
	if (dir.exists) {
		dir.delete();
	}
}
