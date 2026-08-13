import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { type HistoricalEntry, rememberedCategory } from "@/domain/merchant-history";

/**
 * How far back a lookup reads before giving up on remembering a merchant.
 *
 * The window is recency, not a text match: `merchantKey` folds diacritics and
 * collapses punctuation, and SQLite has no equivalent, so a `LIKE` narrowed on
 * the normalised key would silently miss every accented spelling it was meant
 * to find — "panaderia" against a stored "Panadería". Reading a bounded window
 * and comparing exactly in JS is slower in theory and correct in practice.
 *
 * A merchant absent from the last 500 filed entries on this side of the ledger
 * is not remembered. That is a deliberate bound, and it sits behind the 600ms
 * enrichment debounce.
 */
export const HISTORY_WINDOW = 500;

/**
 * The category this user has filed this merchant under before, or null.
 *
 * Scoped to `income` because a category belongs to one side of the ledger: a
 * refund from a shop the user files under an expense category must not answer
 * with it.
 */
export async function rememberedCategoryFor(db: Database, key: string, income: boolean): Promise<string | null> {
	if (key === "") {
		return null;
	}

	const rows = await db
		.select({ categoryId: transactions.categoryId, date: transactions.date, note: transactions.note })
		.from(transactions)
		.where(
			and(
				eq(transactions.income, income),
				isNotNull(transactions.categoryId),
				isNull(transactions.deletedAt),
				ne(transactions.note, "")
			)
		)
		.orderBy(desc(transactions.date))
		.limit(HISTORY_WINDOW);

	const entries: HistoricalEntry[] = [];
	for (const row of rows) {
		if (row.categoryId == null) {
			continue;
		}
		entries.push({ categoryId: row.categoryId, date: row.date.getTime(), note: row.note });
	}
	return rememberedCategory(entries, key);
}
