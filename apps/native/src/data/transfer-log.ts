import { and, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transfers } from "@/db/schema";
import type { LogFilter } from "@/domain/log-filter";
import { filterPeriodUnit } from "@/domain/log-filter";
import { cursorEnd, cursorStart } from "@/domain/log-period-cursor";
import { type TransferLogRow, toTransferLogRow } from "@/domain/transfer-log-rows";
import { useAccounts } from "./accounts";
import { useLiveQuery } from "./live-query";

export interface TransferBounds {
	/**
	 * Which column the floor is measured against, because the transaction read
	 * beside it differs by scope: the window pages on `day`, a period filter
	 * bounds on `date` (`log-filtered.ts`). Comparing a period against `day`
	 * splits a transfer from a transaction at the same instant whenever the two
	 * disagree — which is any row synced from a device in another timezone.
	 */
	floorOn: "date" | "day";
	/** Inclusive floor; null reaches back to the first transfer recorded. */
	since: Date | null;
	/** Exclusive ceiling on `date`; null stops at now. */
	until: Date | null;
}

export interface TransferScope {
	/** Where a day/week/month filter is pointed. Normalized here, not by the caller. */
	cursor: Date;
	filter: LogFilter;
	/** 1 = Sunday, 2 = Monday. */
	firstWeekday: number;
	/** The unfiltered list's paged window: its oldest loaded day, and whether it holds every day there is. */
	page: { floor: Date | null; reachedEnd: boolean };
}

/**
 * The stretch of transfers that belongs beside the transactions a filter
 * selected. Null for the scopes no transfer can be part of: it carries no
 * category, no direction and no schedule.
 */
export function logTransferBounds(scope: TransferScope): TransferBounds | null {
	const unit = filterPeriodUnit(scope.filter);
	if (unit) {
		return {
			floorOn: "date",
			since: cursorStart(unit, scope.cursor, scope.firstWeekday),
			until: cursorEnd(unit, scope.cursor, scope.firstWeekday),
		};
	}
	switch (scope.filter) {
		case "all":
			return { floorOn: "day", since: scope.page.reachedEnd ? null : scope.page.floor, until: null };
		case "transfers":
			return { floorOn: "day", since: null, until: null };
		default:
			return null;
	}
}

/** Null bounds admit no transfer at all, as a query matching nothing: a hook cannot be skipped. */
export function useLogTransfers(db: Database, nowMs: number, bounds: TransferBounds | null): TransferLogRow[] {
	const accounts = useAccounts(db);
	const rows = useLiveQuery(
		transfers,
		() =>
			db
				.select()
				.from(transfers)
				.where(
					bounds === null
						? eq(transfers.id, "")
						: and(
								isNull(transfers.deletedAt),
								lte(transfers.date, new Date(nowMs)),
								bounds.since ? gte(bounds.floorOn === "day" ? transfers.day : transfers.date, bounds.since) : undefined,
								bounds.until ? lt(transfers.date, bounds.until) : undefined
							)
				)
				.orderBy(desc(transfers.day), desc(transfers.date)),
		[nowMs, bounds === null, bounds?.floorOn, bounds?.since?.getTime() ?? 0, bounds?.until?.getTime() ?? 0]
	);
	const names = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
	return useMemo(() => rows.map((row) => toTransferLogRow(row, names)), [rows, names]);
}
