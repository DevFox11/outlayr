import {
	and,
	desc,
	eq,
	getTableColumns,
	gte,
	inArray,
	isNull,
	lt,
	lte,
} from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";

export interface WindowTransactionsQuery {
	start: Date;
	/** Exclusive, and clamped against `nowMs` so the future never shows. */
	end: Date;
	nowMs: number;
	/** Restricts to one direction; `null` keeps both. */
	income?: boolean | null;
	/**
	 * Restricts to a top-level category and its children, mirroring the Swift
	 * `category == %@ OR category.parent == %@` predicate. `null` keeps all.
	 */
	categoryId?: string | null;
}

/**
 * Newest first. The category relationship is resolved through
 * {@link useCategoryMeta} rather than a join, for both the child filter and the
 * display fields: `useLiveQuery` only invalidates on the table it watches, so a
 * joined category would leave a renamed or re-parented category stale until some
 * *transaction* was written.
 */
export function useWindowTransactions(
	db: Database,
	query: WindowTransactionsQuery | null,
): TransactionWithCategory[] {
	const categoryMeta = useCategoryMeta(db);

	const startMs = query?.start.getTime() ?? 0;
	const endMs = query?.end.getTime() ?? 0;
	const nowMs = query?.nowMs ?? 0;
	const income = query?.income ?? null;
	const categoryId = query?.categoryId ?? null;
	const enabled = query != null;

	const contributingIds = useMemo(() => {
		if (!categoryId) {
			return null;
		}
		const ids = [categoryId];
		for (const [id, meta] of categoryMeta) {
			if (meta.parentId === categoryId) {
				ids.push(id);
			}
		}
		return ids;
	}, [categoryId, categoryMeta]);

	// A primitive so the subscription re-runs when the contributing set changes
	// without re-subscribing on every render's fresh array identity.
	const contributingKey = contributingIds?.join(",") ?? "";

	const data = useLiveQuery(transactions, () => {
		if (!enabled) {
			return db
				.select(getTableColumns(transactions))
				.from(transactions)
				.where(eq(transactions.id, ""))
				.limit(0);
		}
		return db
			.select(getTableColumns(transactions))
			.from(transactions)
			.where(
				and(
					isNull(transactions.deletedAt),
					gte(transactions.date, new Date(startMs)),
					lt(transactions.date, new Date(endMs)),
					lte(transactions.date, new Date(nowMs)),
					income == null ? undefined : eq(transactions.income, income),
					contributingIds
						? inArray(transactions.categoryId, contributingIds)
						: undefined,
				),
			)
			.orderBy(desc(transactions.date));
	}, [enabled, startMs, endMs, nowMs, income, contributingKey]);

	return useMemo(
		() =>
			data.map((row) => {
				const meta = row.categoryId
					? categoryMeta.get(row.categoryId)
					: undefined;
				return {
					...row,
					categoryName: meta?.name ?? null,
					categoryColor: meta?.color ?? null,
					categoryIcon: meta?.icon ?? null,
				};
			}),
		[data, categoryMeta],
	);
}
