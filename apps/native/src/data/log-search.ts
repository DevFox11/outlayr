import { useMemo } from "react";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import { searchedTransactionsQuery } from "./log-search-core";
import { useDecoratedRows } from "./transactions";
import type { TransactionWithCategory } from "./transactions";
import type { Transaction } from "./transactions-core";

/**
 * A Log row plus the note's free text. Search matches on it, so a result row
 * carries it and can say so; every other surface keeps the narrower shape.
 */
export type SearchedTransaction = TransactionWithCategory & Pick<Transaction, "details">;

/**
 * The matching category ids are resolved from the reactive meta map and handed to
 * the query — see {@link searchedTransactionsQuery} for the predicate itself.
 */
export function useSearchedTransactions(db: Database, query: string, nowMs: number): SearchedTransaction[] {
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
        () => searchedTransactionsQuery(db, { categoryIds, nowMs, query: trimmed }),
        [trimmed, categoryIds.join(","), nowMs]
    );

    return useDecoratedRows(db, rows);
}
