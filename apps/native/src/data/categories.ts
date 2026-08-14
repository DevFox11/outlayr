import { and, asc, eq, isNull } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { valueCell } from "@/domain/currency-totals";

import type { Category, CategoryWithChildren } from "./categories-core";
import { categoryCellQuery, toCurrencyCell } from "./cell-query";
import { useLiveQuery } from "./live-query";
import { useValuation } from "./use-valuation";

export interface CategoryMetaRow {
    color: string | null;
    emoji: string | null;
    icon: string | null;
    name: string | null;
    parentId: string | null;
}

/**
 * These fields must NOT be joined onto a transaction or budget query:
 * `useLiveQuery` registers its change listener against one table only, so a
 * joined category column survives every edit to that category. A stale name or
 * colour is cosmetic; a stale `parentId` is not — `contributesTo` then credits
 * the spend to the category's old parent budget, so a screen's legend updates
 * while its numbers silently do not.
 */
export function useCategoryMeta(db: Database): Map<string, CategoryMetaRow> {
    const rows = useLiveQuery(categories, () =>
        db
            .select({
                color: categories.color,
                emoji: categories.emoji,
                icon: categories.icon,
                id: categories.id,
                name: categories.name,
                parentId: categories.parentId,
            })
            .from(categories)
            .where(isNull(categories.deletedAt))
    );
    return useMemo(() => {
        const byId = new Map<string, CategoryMetaRow>();
        for (const row of rows) {
            byId.set(row.id, {
                color: row.color,
                emoji: row.emoji,
                icon: row.icon,
                name: row.name,
                parentId: row.parentId,
            });
        }
        return byId;
    }, [rows]);
}

/**
 * Ports Swift's `Category.allTransactions` reduction: all-time and unfiltered by
 * date, so a scheduled future log counts exactly as it does there. Soft-deleted
 * rows are excluded because Core Data's relationship never holds deleted objects.
 *
 * Each entry counts only the category's own transactions — a parent's rolled-up
 * figure is composed by the caller, mirroring
 * `allTransactionsIncludingChildren`.
 */
export function useCategoryTotals(db: Database): Map<string, number> {
    // Grouped in SQL, since this is unbounded by date and reducing in JS would
    // pull every transaction ever on each re-run; `transactions_categoryId_idx`
    // serves it. Currency and day fall out of the grouping because a figure
    // spanning currencies converts each part at the rate of its own day.
    const rows = useLiveQuery(transactions, () => categoryCellQuery(db));
    const { displayCurrency, rates } = useValuation(db);
    return useMemo(() => {
        const totals = new Map<string, number>();
        for (const row of rows) {
            if (row.categoryId == null) {
                continue;
            }
            const cell = toCurrencyCell(row);
            const previous = totals.get(row.categoryId) ?? 0;
            totals.set(row.categoryId, previous + valueCell(cell, displayCurrency, rates));
        }
        return totals;
    }, [rows, displayCurrency, rates]);
}

/** Top-level categories only, each with its ordered children nested. */
export function useCategoriesByNamespace(db: Database, income: boolean): CategoryWithChildren[] {
    const rows = useLiveQuery(
        categories,
        () =>
            db
                .select()
                .from(categories)
                .where(and(eq(categories.income, income), isNull(categories.deletedAt)))
                .orderBy(asc(categories.sortOrder)),
        [income]
    ) as Category[];
    // Memoized so the nested objects keep their identity between renders: the
    // picker's rows are `memo`'d, and a freshly spread parent on every render
    // would re-render the whole list on each keystroke.
    return useMemo(() => {
        const parents = rows.filter((row) => row.parentId == null);
        const childrenByParent = new Map<string, Category[]>();
        for (const row of rows) {
            if (row.parentId != null) {
                const bucket = childrenByParent.get(row.parentId) ?? [];
                bucket.push(row);
                childrenByParent.set(row.parentId, bucket);
            }
        }
        return parents.map((parent) => ({
            ...parent,
            children: childrenByParent.get(parent.id) ?? [],
        }));
    }, [rows]);
}
