import type { ImportEntry } from "@/data/transfer-core";
import { reviewEntryIdentity } from "@/domain/import-review-identity";
import { logoCacheKey, readCachedLogo } from "@/lib/logo-cache";

interface Brand {
	bytes: Uint8Array;
	color: string | null;
}

/**
 * The same identity a manually-entered merchant gets: logo bytes persisted
 * into photo storage per transaction (so deleting one row can never orphan
 * another's image) and the glow tint the picker would have extracted. Cache
 * bytes and tint are resolved once per domain; a merchant the logo cache
 * cannot answer for keeps its category tile.
 */
export async function attachImportLogos(
	entries: readonly ImportEntry[],
): Promise<ImportEntry[]> {
	const photoStorage =
		require("@/lib/photo-storage") as typeof import("@/lib/photo-storage");
	const { glowFromImage } =
		require("@/theme/glow") as typeof import("@/theme/glow");

	const brands = new Map<string, Brand | null>();
	const result: ImportEntry[] = [];
	for (const entry of entries) {
		const identity = reviewEntryIdentity(entry.note);
		if (identity.domain == null) {
			result.push(entry);
			continue;
		}
		let brand = brands.get(identity.domain);
		if (brand === undefined) {
			const cached = await readCachedLogo(
				logoCacheKey(identity.domain, identity.domain),
			);
			brand =
				cached.kind === "logo" ? { bytes: cached.bytes, color: null } : null;
			brands.set(identity.domain, brand);
		}
		if (brand == null) {
			result.push(entry);
			continue;
		}
		try {
			const imageUri = await photoStorage.persistLogoBytes(brand.bytes);
			if (brand.color == null) {
				const hues = await glowFromImage(imageUri);
				brand.color = hues[0] ?? null;
			}
			result.push({ ...entry, imageUri, imageColor: brand.color });
		} catch {
			result.push(entry);
		}
	}
	return result;
}
