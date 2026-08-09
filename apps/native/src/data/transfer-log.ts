import { and, desc, gte, isNull, lte } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { transfers } from "@/db/schema";
import { type TransferLogRow, toTransferLogRow } from "@/domain/transfer-log-rows";
import { useAccounts } from "./accounts";
import { useLiveQuery } from "./live-query";

/**
 * The log's transfer rows for the same window the transaction query walks.
 * Kept a separate read rather than a UNION: the two tables have nothing in
 * common column-wise, and merging two already-ordered lists in JS is cheaper
 * than teaching SQL to project one into the other.
 */
export function useLogTransfers(db: Database, nowMs: number, since: Date | null): TransferLogRow[] {
	const accounts = useAccounts(db);
	const rows = useLiveQuery(
		transfers,
		() =>
			db
				.select()
				.from(transfers)
				.where(
					and(
						isNull(transfers.deletedAt),
						lte(transfers.date, new Date(nowMs)),
						since ? gte(transfers.date, since) : undefined
					)
				)
				.orderBy(desc(transfers.day), desc(transfers.date)),
		[nowMs, since?.getTime() ?? 0]
	);
	const names = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
	return useMemo(() => rows.map((row) => toTransferLogRow(row, names)), [rows, names]);
}
