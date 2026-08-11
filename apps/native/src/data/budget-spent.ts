import { and, eq, isNull, lte } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { transactions } from "@/db/schema";

/**
 * Any Drizzle SQLite handle: the app's `expo-sqlite` client in production and a
 * `better-sqlite3` one under test.
 *
 * Both drivers are `"sync"` — they execute on the calling thread and the promise
 * is only a convenience. Saying so keeps `.all()` typed as rows rather than as
 * `rows | Promise<rows>`, which is what lets `useLiveQuery` read in render; a
 * builder widened to `"sync" | "async"` is barred from it.
 */
export type SpendDb = BaseSQLiteDatabase<"sync", unknown, Record<string, unknown>>;

/**
 * The one query every budget figure is built from. There is no per-budget SQL:
 * each budget's window and category rule is applied in JS over this one result
 * — see {@link spentForCategory} — because `useLiveQuery` registers a fresh
 * database listener per call, and a screen of budgets querying individually
 * re-runs the same full scan on every insert.
 */
export function expenseContributionQuery(db: SpendDb, now: Date) {
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
		.where(and(eq(transactions.income, false), isNull(transactions.deletedAt), lte(transactions.date, now)));
}

/**
 * A subcategory counts toward its parent's budget. A null `categoryId` is the
 * overall budget, which every expense feeds.
 */
export function contributesTo(row: ExpenseContribution, categoryId: string | null | undefined): boolean {
	if (categoryId == null) {
		return true;
	}
	return row.categoryId === categoryId || row.parentId === categoryId;
}

/**
 * Already filtered to non-deleted expenses dated on or before now, and carrying
 * its category's `parentId`.
 */
export interface ExpenseContribution {
	amount: number;
	categoryId: string | null;
	date: Date;
	parentId: string | null;
}

/**
 * Spend over `[start, now]`. Ports
 * `BudgetRepository.fetchRequestForBudgetTransactions`.
 */
export function spentForCategory(
	rows: readonly ExpenseContribution[],
	categoryId: string,
	start: Date,
	now: Date
): number {
	const startMs = start.getTime();
	const nowMs = now.getTime();
	let total = 0;
	for (const row of rows) {
		const t = row.date.getTime();
		if (t < startMs || t > nowMs) {
			continue;
		}
		if (contributesTo(row, categoryId)) {
			total += row.amount;
		}
	}
	return total;
}

/**
 * Every expense over `[start, now]`, whatever its category. Ports
 * `BudgetRepository.fetchRequestForMainBudgetTransactions`.
 */
export function spentForMain(rows: readonly ExpenseContribution[], start: Date, now: Date): number {
	const startMs = start.getTime();
	const nowMs = now.getTime();
	let total = 0;
	for (const row of rows) {
		const t = row.date.getTime();
		if (t >= startMs && t <= nowMs) {
			total += row.amount;
		}
	}
	return total;
}
