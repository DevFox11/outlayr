import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";
import { LOG_COLUMNS } from "./transactions-core";

/** Escapes the wildcards SQLite's LIKE would otherwise read as pattern syntax. */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Newest first. A query matches a note that contains it, a category whose name
 * contains it, or — when the query parses as a number — an amount equal to it.
 * Mirrors Swift's `FilteredSearchView` compound predicate; `LIKE` is
 * case-insensitive for ASCII in SQLite, which is what `[cd]` bought there.
 *
 * The category arm can't be a join: `useLiveQuery` listens to one table, so a
 * joined category name would survive every edit to that category. The matching
 * category ids are resolved from the reactive meta map instead.
 */
export function useSearchedTransactions(
	db: Database,
	query: string,
): TransactionWithCategory[] {
	const meta = useCategoryMeta(db);
	const trimmed = query.trim();
	const needle = trimmed.toLowerCase();

	const categoryIds = useMemo(() => {
		if (needle === "") {
			return [];
		}
		const ids: string[] = [];
		for (const [id, row] of meta) {
			if (row.name?.toLowerCase().includes(needle)) {
				ids.push(id);
			}
		}
		return ids;
	}, [meta, needle]);

	const amount = Number.parseFloat(trimmed);
	const amountMatch = trimmed !== "" && Number.isFinite(amount);

	const rows = useLiveQuery(transactions, () => {
		if (trimmed === "") {
			// An empty query matches nothing rather than everything: the screen
			// shows its idle state, and a full-table read would be wasted.
			return db
				.select(LOG_COLUMNS)
				.from(transactions)
				.where(eq(transactions.id, ""));
		}
		return db
			.select(LOG_COLUMNS)
			.from(transactions)
			.where(
				and(
					isNull(transactions.deletedAt),
					or(
						like(transactions.note, `%${escapeLike(trimmed)}%`),
						categoryIds.length > 0
							? inArray(transactions.categoryId, categoryIds)
							: undefined,
						amountMatch ? eq(transactions.amount, amount) : undefined,
					),
				),
			)
			.orderBy(desc(transactions.day), desc(transactions.date));
	}, [trimmed, categoryIds.join(","), amountMatch ? amount : null]);

	return useMemo(
		() =>
			rows.map((row) => {
				const found = row.categoryId ? meta.get(row.categoryId) : undefined;
				return {
					...row,
					categoryName: found?.name ?? null,
					categoryColor: found?.color ?? null,
					categoryIcon: found?.icon ?? null,
					categoryEmoji: found?.emoji ?? null,
				};
			}),
		[rows, meta],
	);
}
