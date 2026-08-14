import { and, desc, eq, isNotNull, isNull, max } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";

import { useLiveQuery } from "./live-query";

export const RECENT_CATEGORY_LIMIT = 5;

/**
 * Ids only. The category's own columns are resolved by the caller against a
 * fresh read of `categories`, because `useLiveQuery` listens to one table: a
 * name or colour joined on here would survive every edit to that category.
 */
export function recentCategoryIdsQuery(db: Database, income: boolean, limit: number = RECENT_CATEGORY_LIMIT) {
    return db
        .select({ categoryId: transactions.categoryId })
        .from(transactions)
        .where(and(eq(transactions.income, income), isNotNull(transactions.categoryId), isNull(transactions.deletedAt)))
        .groupBy(transactions.categoryId)
        .orderBy(desc(max(transactions.date)))
        .limit(limit);
}

export function useRecentCategoryIds(db: Database, income: boolean, limit: number = RECENT_CATEGORY_LIMIT): string[] {
    const rows = useLiveQuery(transactions, () => recentCategoryIdsQuery(db, income, limit), [income, limit]);
    return rows.map((row) => row.categoryId).filter((id): id is string => id != null);
}
