export type LogoRejection =
	| "status"
	| "content-type"
	| "too-small"
	| "too-large"
	| "not-an-image"
	| "placeholder";

export type LogoVerdict = { ok: true } | { ok: false; reason: LogoRejection };

/**
 * The smallest real logo measured against the live endpoint was amazon.com at
 * 658 bytes, and youtube.com at 794. A 1x1 tracker pixel or a 16px grey globe
 * sits well under 512, so the floor separates them without clipping a real
 * brand mark. Do not raise it.
 */
const MIN_BYTES = 512;
const MAX_BYTES = 262_144;

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];
const ICO = [0x00, 0x00, 0x01, 0x00];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
	if (bytes.length < signature.length) {
		return false;
	}
	return signature.every((byte, index) => bytes[index] === byte);
}

function matchesAt(
	bytes: Uint8Array,
	offset: number,
	signature: readonly number[],
): boolean {
	if (bytes.length < offset + signature.length) {
		return false;
	}
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * A `content-type` header is whatever the server chose to claim. Checking the
 * leading bytes is what actually rejects an HTML error page served as
 * `image/png`, and any polyglot that survives is destroyed by the re-encode in
 * `persistPickedPhoto`.
 */
function isRasterImage(bytes: Uint8Array): boolean {
	return (
		startsWith(bytes, PNG) ||
		startsWith(bytes, JPEG) ||
		startsWith(bytes, GIF) ||
		startsWith(bytes, ICO) ||
		(startsWith(bytes, RIFF) && matchesAt(bytes, 8, WEBP))
	);
}

function fnv1a32(bytes: Uint8Array): number {
	let hash = 0x811c9dc5;
	for (const byte of bytes) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}

/**
 * A generic placeholder is byte-identical for every miss, so one fingerprint
 * per known blob identifies it exactly. `length:hash` rather than a
 * cryptographic digest because this matches one known artefact — there is no
 * adversary crafting a preimage, and `expo-crypto`'s digest is async while
 * `node:crypto` cannot be bundled (see `domain/uuid5.ts`).
 *
 * The pinned entry is what `s2/favicons` returns for a domain with no icon. It
 * arrives with a 404 today, so this is the second line rather than the first.
 */
const PLACEHOLDER_FINGERPRINTS: ReadonlySet<string> = new Set([
	"726:1468888882",
]);

export function fingerprint(bytes: Uint8Array): string {
	return `${bytes.length}:${fnv1a32(bytes)}`;
}

export function isRealLogo(
	status: number,
	contentType: string | null,
	bytes: Uint8Array,
): LogoVerdict {
	if (status !== 200) {
		return { ok: false, reason: "status" };
	}
	if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
		return { ok: false, reason: "content-type" };
	}
	if (bytes.length < MIN_BYTES) {
		return { ok: false, reason: "too-small" };
	}
	if (bytes.length > MAX_BYTES) {
		return { ok: false, reason: "too-large" };
	}
	if (!isRasterImage(bytes)) {
		return { ok: false, reason: "not-an-image" };
	}
	if (PLACEHOLDER_FINGERPRINTS.has(fingerprint(bytes))) {
		return { ok: false, reason: "placeholder" };
	}
	return { ok: true };
}
