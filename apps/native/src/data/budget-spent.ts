import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { transactions } from "@/db/schema";
import type * as schema from "@/db/schema";

/**
 * Any Drizzle SQLite handle: the app's `expo-sqlite` client in production and a
 * `better-sqlite3` one under test.
 *
 * Both drivers are `"sync"` — they execute on the calling thread and the promise
 * is only a convenience. Saying so keeps `.all()` typed as rows rather than as
 * `rows | Promise<rows>`, which is what lets `useLiveQuery` read in render; a
 * builder widened to `"sync" | "async"` is barred from it.
 *
 * The schema parameter is this app's own — a handle opened without it cannot
 * answer the queries below, so saying `Record<string, unknown>` here would only
 * defer that to a runtime failure.
 */
export type SpendDb = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

/**
 * The one query every budget figure is built from. There is no per-budget SQL:
 * each budget's window and category rule is applied in JS over this one result
 * — see {@link spentForCategory} — because `useLiveQuery` registers a fresh
 * database listener per call, and a screen of budgets querying individually
 * re-runs the same full scan on every insert. `since` drops the rows before it.
 */
export function expenseContributionQuery(db: SpendDb, now: Date, since: Date | null = null) {
    return db
        .select({
            amount: transactions.amount,
            amountUsd: transactions.amountUsd,
            categoryId: transactions.categoryId,
            currency: transactions.currency,
            date: transactions.date,
            exchangeRate: transactions.exchangeRate,
            exchangeRateType: transactions.exchangeRateType,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.income, false),
                isNull(transactions.deletedAt),
                since ? gte(transactions.date, since) : undefined,
                lte(transactions.date, now)
            )
        )
        .orderBy(asc(transactions.date));
}
