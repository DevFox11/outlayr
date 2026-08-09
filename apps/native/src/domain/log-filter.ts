import type { CursorUnit } from "./log-period-cursor";
import { cursorLabel } from "./log-period-cursor";

/**
 * What the Log's list is scoped to, mirroring the Swift `FilterType` enum. The
 * labels are the enum's own raw values: the Swift catalog carries no English
 * translation for them, so SwiftUI renders the key itself, lowercase and all.
 */
export type LogFilter = "all" | "type" | "day" | "week" | "month" | "category" | "recurring" | "upcoming";

export const LOG_FILTER_ORDER: readonly LogFilter[] = [
	"all",
	"type",
	"day",
	"week",
	"month",
	"category",
	"recurring",
	"upcoming",
];

export const LOG_FILTER_LABEL: Record<LogFilter, string> = {
	all: "all entries",
	category: "by category",
	day: "by day",
	month: "by month",
	recurring: "recurring",
	type: "by type",
	upcoming: "upcoming",
	week: "by week",
};

/** Null for the filters that name no stretch of time. */
export function filterPeriodUnit(filter: LogFilter): CursorUnit | null {
	switch (filter) {
		case "day":
			return "day";
		case "week":
			return "week";
		case "month":
			return "month";
		default:
			return null;
	}
}

export function filterHasMenu(filter: LogFilter): boolean {
	return filterPeriodUnit(filter) !== null || filter === "category" || filter === "type";
}

export interface FilterScopeLabels {
	/** Null until the asynchronous category load resolves. */
	categoryName?: string | null;
	cursor: Date;
	firstWeekday?: number;
	income: boolean;
}

/**
 * What the active filter is scoped to — a category name, a date range, an entry
 * type — or null when no filter is active.
 */
export function filterDetail(filter: LogFilter, scope: FilterScopeLabels): string | null {
	const unit = filterPeriodUnit(filter);
	if (unit) {
		return cursorLabel(unit, scope.cursor, scope.firstWeekday ?? 1);
	}
	switch (filter) {
		case "category":
			// Categories load asynchronously; until one resolves the filter still has
			// to name itself rather than render blank.
			return scope.categoryName || LOG_FILTER_LABEL.category;
		case "type":
			return scope.income ? "Income" : "Expense";
		case "recurring":
			return LOG_FILTER_LABEL.recurring;
		case "upcoming":
			return LOG_FILTER_LABEL.upcoming;
		default:
			return null;
	}
}
