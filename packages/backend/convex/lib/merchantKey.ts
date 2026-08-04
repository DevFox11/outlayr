/**
 * Duplicated from `apps/native/src/domain/merchant-resolver.ts:9-17` rather
 * than imported — the backend package must not depend on `apps/native` (see
 * the tasks artifact's Package Graph Decision). Two raw input strings that
 * normalize to the same key are "the same query" for both the curated map
 * and this shared cache.
 */
export function merchantKey(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}
