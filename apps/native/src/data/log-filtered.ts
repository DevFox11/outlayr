import {
	and,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	or,
} from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { addDays, startOfDay } from "@/domain/dates";
import type { LogFilter } from "@/domain/log-filter";
import { cursorEnd, cursorStart } from "@/domain/log-period-cursor";
import { nextDate } from "@/domain/recurrence";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";
import { LOG_COLUMNS } from "./transactions-core";

export interface LogFilterScope {
	filter: LogFilter;
	/** Null until a `category` filter resolves one. */
	categoryId: string | null;
	/** Where a day/week/month filter is pointed. Normalized by the caller. */
	cursor: Date;
	/** Which side a `type` filter shows. */
	income: boolean;
	/** 1 = Sunday, 2 = Monday. */
	firstWeekday: number;
}

function visibleAt(now: Date) {
	return and(isNull(transactions.deletedAt), lte(transactions.date, now));
}

/**
 * The category itself plus its children. Mirrors Swift's
 * `category == %@ OR category.parent == %@`.
 */
function categoryScope(
	categoryId: string,
	meta: Map<string, { parentId: string | null }>,
): string[] {
	const ids = [categoryId];
	for (const [id, row] of meta) {
		if (row.parentId === categoryId) {
			ids.push(id);
		}
	}
	return ids;
}

/**
 * Unwindowed on purpose: every one of these scopes is bounded by the filter
 * itself, and a subtotal that only counted the loaded page would be wrong.
 *
 * Returns null for `all` and `upcoming`, which the screen serves from
 * `useLoggedTransactions` and {@link useUpcomingTransactions} instead.
 */
function filterPredicate(
	scope: LogFilterScope,
	now: Date,
	categoryIds: string[] | null,
) {
	switch (scope.filter) {
		case "category":
			return categoryIds && categoryIds.length > 0
				? and(visibleAt(now), inArray(transactions.categoryId, categoryIds))
				: null;
		case "day":
			return and(
				visibleAt(now),
				eq(transactions.day, cursorStart("day", scope.cursor)),
			);
		case "week":
		case "month": {
			const unit = scope.filter;
			const start = cursorStart(unit, scope.cursor, scope.firstWeekday);
			const end = cursorEnd(unit, scope.cursor, scope.firstWeekday);
			// The current window ends at "now", not at its own boundary: a future-
			// dated row inside this week belongs to Upcoming, not to the list.
			const upper = end.getTime() > now.getTime() ? now : end;
			return and(
				isNull(transactions.deletedAt),
				gte(transactions.date, start),
				lt(transactions.date, upper),
			);
		}
		case "type":
			return and(visibleAt(now), eq(transactions.income, scope.income));
		case "recurring":
			return and(visibleAt(now), eq(transactions.onceRecurring, true));
		default:
			return null;
	}
}

/**
 * Display fields come from {@link useCategoryMeta} rather than a join: a join
 * would leave every row showing a renamed category's old name and colour until
 * some *transaction* was written.
 */
function useDecorated(
	db: Database,
	rows: { categoryId: string | null }[],
): TransactionWithCategory[] {
	const meta = useCategoryMeta(db);
	return useMemo(
		() =>
			rows.map((row) => {
				const found = row.categoryId ? meta.get(row.categoryId) : undefined;
				return {
					...row,
					categoryName: found?.name ?? null,
					categoryColor: found?.color ?? null,
					categoryIcon: found?.icon ?? null,
				};
			}) as TransactionWithCategory[],
		[rows, meta],
	);
}

/**
 * `all` and `upcoming` return empty — the screen serves those from the paged
 * window and from {@link useUpcomingTransactions}.
 */
export function useFilteredTransactions(
	db: Database,
	nowMs: number,
	scope: LogFilterScope,
): TransactionWithCategory[] {
	const meta = useCategoryMeta(db);
	const categoryIds =
		scope.filter === "category" && scope.categoryId
			? categoryScope(scope.categoryId, meta)
			: null;
	const now = new Date(nowMs);
	const where = filterPredicate(scope, now, categoryIds);
	// The cursor is part of the key, not just the closure: `useLiveQuery` only
	// re-runs when the table changes or a dependency does, and stepping the cursor
	// changes neither on its own.
	const rows = useLiveQuery(
		transactions,
		() =>
			where
				? db
						.select(LOG_COLUMNS)
						.from(transactions)
						.where(where)
						.orderBy(desc(transactions.day), desc(transactions.date))
				: db
						.select(LOG_COLUMNS)
						.from(transactions)
						.where(eq(transactions.id, "")),
		[
			nowMs,
			scope.filter,
			scope.categoryId,
			scope.cursor.getTime(),
			scope.income,
			scope.firstWeekday,
			categoryIds?.join(",") ?? "",
		],
	);

	return useDecorated(db, rows);
}

/**
 * Sorted by when each entry will next land, furthest out first, matching Swift's
 * `FutureListView`. `limited` clips the list to the next two weeks.
 */
export function useUpcomingTransactions(
	db: Database,
	nowMs: number,
	limited: boolean,
): TransactionWithCategory[] {
	const now = new Date(nowMs);
	const rows = useLiveQuery(
		transactions,
		() =>
			db
				.select(LOG_COLUMNS)
				.from(transactions)
				.where(
					and(
						isNull(transactions.deletedAt),
						or(
							// A scheduled entry is upcoming even when its stored date is
							// past: what is upcoming is its next occurrence.
							gt(transactions.recurringType, 0),
							gt(transactions.date, now),
						),
					),
				),
		[nowMs],
	);

	const decorated = useDecorated(db, rows);

	return useMemo(() => {
		const horizon = addDays(startOfDay(now), 14);
		const kept = limited
			? decorated.filter(
					(row) => landingDate(row, now).getTime() < horizon.getTime(),
				)
			: decorated;

		return [...kept].sort(
			(a, b) => landingDate(b, now).getTime() - landingDate(a, now).getTime(),
		);
	}, [decorated, limited, now]);
}

/** Swift's `nextTransactionDate`. */
export function landingDate(row: TransactionWithCategory, now: Date): Date {
	if (row.date.getTime() > now.getTime()) {
		return row.date;
	}
	return (
		nextDate(
			row.day ?? row.date,
			row.recurringType,
			row.recurringCoefficient ?? 1,
		) ?? row.date
	);
}
