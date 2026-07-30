/** Longer than this stops being a label and starts being a note. */
export const TAG_NAME_LIMIT = 24;

/**
 * A tag's stored form. Collapses inner whitespace so "work  trip" and
 * "work trip" are one tag rather than two that look identical in a list.
 */
export function normalizeTagName(raw: string): string {
	return raw.trim().replace(/\s+/g, " ").slice(0, TAG_NAME_LIMIT);
}

/**
 * The form two names are compared by.
 *
 * Case-insensitive, so "Work" cannot sit beside "work" — the display keeps
 * whichever casing the owner typed first, because correcting someone's
 * capitalisation is not this feature's job.
 */
export function tagKey(name: string): string {
	return normalizeTagName(name).toLocaleLowerCase();
}

export function isUsableTagName(raw: string): boolean {
	return normalizeTagName(raw).length > 0;
}

export interface NamedTag {
	id: string;
	name: string;
}

/** The tag already answering to `name`, or null. */
export function findTagByName<T extends NamedTag>(
	tags: readonly T[],
	name: string,
): T | null {
	const key = tagKey(name);
	return tags.find((tag) => tagKey(tag.name) === key) ?? null;
}

/**
 * `tags` in the order they should read, and never with a duplicate.
 *
 * Sorted by name rather than by creation, because a picker is scanned rather
 * than remembered; ties keep their existing order so the list does not shuffle
 * under a rename that only changed case.
 */
export function sortTags<T extends NamedTag>(tags: readonly T[]): T[] {
	return [...tags].sort((a, b) => tagKey(a.name).localeCompare(tagKey(b.name)));
}

/**
 * Which links to write and which to retire so a row ends up carrying exactly
 * `next`.
 *
 * A diff rather than a delete-all-and-reinsert: every write replicates, so
 * rewriting an unchanged link would push a row to every other device for
 * nothing, and its tombstone-then-recreate would briefly show the entry
 * untagged on the far side.
 */
export function tagLinkDiff(
	current: readonly string[],
	next: readonly string[],
): { attach: string[]; detach: string[] } {
	const before = new Set(current);
	const after = new Set(next);
	return {
		attach: [...after].filter((id) => !before.has(id)),
		detach: [...before].filter((id) => !after.has(id)),
	};
}
