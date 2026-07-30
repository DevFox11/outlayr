import { and, desc, eq, inArray, isNull, like, lte, or } from "drizzle-orm";
import { transactions } from "@/db/schema";
import type { SpendDb } from "./budget-spent";
import { LOG_COLUMNS } from "./transactions-core";

/** Escapes the wildcards SQLite's LIKE would otherwise read as pattern syntax. */
export function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export interface SearchCriteria {
	/** Already trimmed. An empty query matches nothing rather than everything. */
	query: string;
	/**
	 * Categories whose name matched, resolved outside SQL: `useLiveQuery` listens
	 * to one table, so a joined category name would survive every edit to it.
	 */
	categoryIds: string[];
	/** The shared clock reading — see `useNow`. */
	nowMs: number;
}

/**
 * Newest first. A query matches a note that contains it, a category whose name
 * contains it, or — when the query parses as a number — an amount equal to it.
 * Mirrors Swift's `FilteredSearchView` compound predicate; `LIKE` is
 * case-insensitive for ASCII in SQLite, which is what `[cd]` bought there.
 *
 * Bounded by `date <= now` like every other ledger read (`visibleAt` in
 * `transactions-core`). Swift searched unbounded, but Swift printed no totals:
 * a result set carrying next month's scheduled rent would have the header answer
 * "how much have I spent on rent" with money that has not moved, and disagree
 * with the Log, Insights and every budget. Rows dated ahead are still reachable —
 * Settings → Upcoming is the surface that owns them.
 */
export function searchedTransactionsQuery(
	db: SpendDb,
	criteria: SearchCriteria,
) {
	const { query, categoryIds, nowMs } = criteria;

	if (query === "") {
		// The screen shows its idle state, and a full-table read would be wasted.
		return db
			.select(LOG_COLUMNS)
			.from(transactions)
			.where(eq(transactions.id, ""));
	}

	const amount = Number.parseFloat(query);

	return db
		.select(LOG_COLUMNS)
		.from(transactions)
		.where(
			and(
				isNull(transactions.deletedAt),
				lte(transactions.date, new Date(nowMs)),
				or(
					like(transactions.note, `%${escapeLike(query)}%`),
					categoryIds.length > 0
						? inArray(transactions.categoryId, categoryIds)
						: undefined,
					Number.isFinite(amount) ? eq(transactions.amount, amount) : undefined,
				),
			),
		)
		.orderBy(desc(transactions.day), desc(transactions.date));
}
