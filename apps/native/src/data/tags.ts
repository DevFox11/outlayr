import { isNull } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { tags, transactionTags } from "@/db/schema";
import { sortTags } from "@/domain/tags";
import { useLiveQuery } from "./live-query";
import { liveTagsQuery, type TagRow, tagIdsForQuery } from "./tags-core";

export type { TagRow } from "./tags-core";
export { tagsRepo } from "./tags-core";

/** Every live tag, in the order a picker should read them. */
export function useTags(db: Database): TagRow[] {
	const rows = useLiveQuery(tags, () => liveTagsQuery(db));
	return useMemo(() => sortTags(rows), [rows]);
}

/**
 * The tag ids a transaction carries. Keyed on the id so a form opened on a
 * different entry re-reads rather than showing the last one's tags.
 */
export function useTagIdsFor(
	db: Database,
	transactionId: string | null,
): string[] {
	const rows = useLiveQuery(
		transactionTags,
		() => tagIdsForQuery(db, transactionId ?? ""),
		[transactionId],
	);
	return useMemo(
		() => (transactionId ? rows.map((row) => row.tagId) : []),
		[rows, transactionId],
	);
}

/**
 * Tag ids by transaction id, for a list that paints them per row.
 *
 * One query for the whole screen rather than one per row: the Log renders a
 * page of entries at a time, and a hook per row would register a listener per
 * row against the same table.
 */
export function useTagIdsByTransaction(db: Database): Map<string, string[]> {
	const rows = useLiveQuery(transactionTags, () =>
		db
			.select({
				transactionId: transactionTags.transactionId,
				tagId: transactionTags.tagId,
			})
			.from(transactionTags)
			// Tombstones stay in the table so the deletion replicates; painting one
			// would show a tag the owner removed.
			.where(isNull(transactionTags.deletedAt)),
	);
	return useMemo(() => {
		const byTransaction = new Map<string, string[]>();
		for (const row of rows) {
			const existing = byTransaction.get(row.transactionId);
			if (existing) {
				existing.push(row.tagId);
			} else {
				byTransaction.set(row.transactionId, [row.tagId]);
			}
		}
		return byTransaction;
	}, [rows]);
}
