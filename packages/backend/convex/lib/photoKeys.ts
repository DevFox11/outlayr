/**
 * The naming rules for a transaction photo's R2 object key.
 *
 * A key is `transaction-photos/<userId>/<name>`, where `<name>` is the photo's
 * file name on the device that picked it. Two properties are load-bearing:
 *
 * The user id is a *path segment the server writes*, never an argument. Reading
 * or deleting an object is authorized by re-deriving the prefix from the
 * session, so a client cannot name its way into another account's bucket space.
 *
 * The name half is the device's file name, which makes the key derivable rather
 * than allocated. An upload interrupted halfway re-derives the same key and
 * overwrites, instead of stranding bytes under a key no row will ever name.
 */
export const PHOTO_KEY_PREFIX = "transaction-photos";

/**
 * Deliberately narrower than "a legal S3 key": no slashes, so a name can never
 * add a path segment; no leading dot, so `..` cannot escape the prefix.
 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isPhotoName(name: string): boolean {
	return NAME_PATTERN.test(name);
}

export function photoKeyFor(userId: string, name: string): string {
	return `${PHOTO_KEY_PREFIX}/${userId}/${name}`;
}

/**
 * Whether `key` is one this account is allowed to read, re-mint a url for, or
 * delete. Built by comparison against a freshly derived key rather than by
 * parsing the incoming one, so a key that merely looks well-formed does not pass.
 */
export function ownsPhotoKey(userId: string, key: string): boolean {
	const name = photoNameFromKey(key);
	return name !== null && photoKeyFor(userId, name) === key;
}

/**
 * T8: a `merchant/…` object (the shared, unowned logo cache written by
 * `groundedLookup.ts`) must never be mistaken for an owned
 * `transaction-photos/…` one. The segment-count check below already refuses
 * it incidentally (two segments, not three), but the explicit check makes
 * that guarantee survive either prefix constant changing independently of
 * the other.
 */
const MERCHANT_CACHE_KEY_PREFIX = "merchant/";

/** The device-side file name a key was minted from, or null if it is malformed. */
export function photoNameFromKey(key: string): string | null {
	if (key.startsWith(MERCHANT_CACHE_KEY_PREFIX)) {
		return null;
	}
	const segments = key.split("/");
	if (segments.length !== 3 || segments[0] !== PHOTO_KEY_PREFIX) {
		return null;
	}
	return isPhotoName(segments[2]) ? segments[2] : null;
}

/**
 * The account a key belongs to, or null if it is malformed.
 *
 * Only for server-side bookkeeping that already holds a trusted key — it reads
 * the owner *out of* the key, where {@link ownsPhotoKey} checks a key against an
 * owner the session proved. Never authorize with this: it would take the
 * caller's word for whose object they are naming.
 *
 * Validated by round-trip like its sibling, so a key that merely has three
 * segments does not pass.
 */
export function photoOwnerFromKey(key: string): string | null {
	const [, userId] = key.split("/");
	const name = photoNameFromKey(key);
	if (name === null) {
		return null;
	}
	return userId !== "" && photoKeyFor(userId, name) === key ? userId : null;
}
