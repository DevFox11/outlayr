import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import { searchedTransactionsQuery } from "./log-search-core";
import type { TransactionWithCategory } from "./transactions";

/**
 * The matching category ids are resolved from the reactive meta map and handed to
 * the query — see {@link searchedTransactionsQuery} for the predicate itself.
 */
export function useSearchedTransactions(
	db: Database,
	query: string,
	nowMs: number,
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

	const rows = useLiveQuery(
		transactions,
		() => searchedTransactionsQuery(db, { query: trimmed, categoryIds, nowMs }),
		[trimmed, categoryIds.join(","), nowMs],
	);

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
