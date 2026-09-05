import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import { transactions } from "@/db/schema";

import type { SpendDb } from "./budget-spent";
import { LOG_COLUMNS } from "./transactions-core";

/** Escapes the wildcards SQLite's LIKE would otherwise read as pattern syntax. */
function escapeLike(value: string): string {
    return value.replaceAll(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Written out rather than using Drizzle's `like()`, which emits no `ESCAPE`
 * clause. SQLite only reads a backslash as an escape when one is declared, so
 * without it the backslashes {@link escapeLike} inserts are matched as literal
 * characters and searching for `50%` finds nothing whatsoever.
 */
function contains(column: SQLiteColumn, query: string): SQL {
    return sql`${column} like ${`%${escapeLike(query)}%`} escape '\\'`;
}

/**
 * The Log's columns plus `details`. Widened here alone: search is the one surface
 * that matches on the free-text note, and a row has to be able to show why it
 * matched. The Log paints no note, so its own read stays as narrow as it was.
 */
const SEARCH_COLUMNS = {
    ...LOG_COLUMNS,
    details: transactions.details,
} as const;

export interface SearchCriteria {
    /**
     * Categories whose name matched, resolved outside SQL: `useLiveQuery` listens
     * to one table, so a joined category name would survive every edit to it.
     */
    categoryIds: string[];
    /** The shared clock reading — see `useNow`. */
    nowMs: number;
    /** Already trimmed. An empty query matches nothing rather than everything. */
    query: string;
}

/**
 * Newest first. A query matches a note that contains it, the note's longer free
 * text, a category whose name contains it, or — when the query parses as a
 * number — an amount equal to it. Mirrors Swift's `FilteredSearchView` compound
 * predicate; `LIKE` is case-insensitive for ASCII in SQLite, which is what `[cd]`
 * bought there.
 *
 * The free text is searched because it is already indexed for Spotlight
 * (`lib/spotlight.ts` puts it in the item's keywords): without this the user
 * could find their own note from the home screen and not from inside the app.
 *
 * Bounded by `date <= now` like every other ledger read (`visibleAt` in
 * `transactions-core`). Swift searched unbounded, but Swift printed no totals:
 * a result set carrying next month's scheduled rent would have the header answer
 * "how much have I spent on rent" with money that has not moved, and disagree
 * with the Log, Insights and every budget. Rows dated ahead are still reachable —
 * Settings → Upcoming is the surface that owns them.
 */
export function searchedTransactionsQuery(db: SpendDb, criteria: SearchCriteria) {
    const { query, categoryIds, nowMs } = criteria;

    if (query === "") {
        // The screen shows its idle state, and a full-table read would be wasted.
        return db.select(SEARCH_COLUMNS).from(transactions).where(eq(transactions.id, ""));
    }

    const amount = Number.parseFloat(query);

    return db
        .select(SEARCH_COLUMNS)
        .from(transactions)
        .where(
            and(
                isNull(transactions.deletedAt),
                lte(transactions.date, new Date(nowMs)),
                or(
                    contains(transactions.note, query),
                    contains(transactions.details, query),
                    categoryIds.length > 0 ? inArray(transactions.categoryId, categoryIds) : undefined,
                    Number.isFinite(amount) ? eq(transactions.amount, amount) : undefined
                )
            )
        )
        .orderBy(desc(transactions.day), desc(transactions.date));
}
