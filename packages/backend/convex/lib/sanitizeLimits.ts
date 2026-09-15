// oxlint-disable unicorn/filename-case -- Convex keys the module by its path, and regenerating the generated api for a lint preference is not a fix

/**
 * The shape limits a merchant field has to satisfy, shared by the two sides that
 * have to agree about them.
 *
 * `enrichment.ts` sanitizes a model's answer down to these, and
 * `merchantTrust.shouldPublish` re-checks them before anything is written to the
 * GLOBAL knowledge table. That re-check is deliberate — it is the last thing
 * standing between a personal string and a row every account can read, so it
 * must not trust its caller.
 *
 * What it must not do is carry its own copy of the numbers. These were written
 * out twice, character for character, and two copies of a privacy filter's
 * limits is one copy that can loosen without the other noticing.
 */

/** Longest legal DNS name, so a domain is bounded by the protocol rather than by taste. */
export const MAX_DOMAIN_LENGTH = 253;

/** A bare apex domain, lowercased: no scheme, no path, no port. */
export const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export const MAX_TAGS = 3;
export const MAX_TAG_LENGTH = 24;

/** An emoji is one pictographic glyph or a short sequence of them. */
export const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
