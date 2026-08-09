const DATE_STRING_LENGTH = 10;

/**
 * Rate rows pin their `date` to UTC so both fetchers agree across
 * local-midnight boundaries.
 */
export function utcDateString(epochMs: number): string {
	return new Date(epochMs).toISOString().slice(0, DATE_STRING_LENGTH);
}
