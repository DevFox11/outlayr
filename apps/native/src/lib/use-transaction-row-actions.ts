import { useRouter } from "expo-router";
import { useCallback } from "react";
import { getTransactionById, transactionsRepo } from "@/data/transactions";
import type { Database } from "@/db/client";
import { transactionRowActions } from "@/domain/transaction-actions";
import { showTransactionActions } from "./transaction-actions";

/**
 * Opens a row's action menu. `future` says the row is being painted as an
 * upcoming occurrence, which the Delete guard needs and the row's own date
 * cannot tell it: a carrier's stored date is its last charge, not its next.
 *
 * The row is read back rather than threaded in, because `LOG_COLUMNS` is a
 * narrow projection and the driver hands the whole row over synchronously.
 */
export function useTransactionRowActions(
	db: Database,
	nowMs: number,
	onDelete: (id: string) => void,
): (id: string, future: boolean) => void {
	const router = useRouter();

	return useCallback(
		(id: string, future: boolean) => {
			const row = getTransactionById(db, id);
			if (row == null) {
				return;
			}
			const now = new Date(nowMs);
			showTransactionActions({
				note: row.note,
				actions: transactionRowActions({
					recurringType: row.recurringType,
					date: row.date,
					future,
					now,
				}),
				pending: row.date.getTime() > now.getTime(),
				onStopRecurring: () => {
					transactionsRepo.stopRecurring(db, id).catch((error) => {
						console.error("Stop recurring failed", error);
					});
				},
				onEdit: () => router.push(`/transaction/${id}`),
				onDelete: () => onDelete(id),
			});
		},
		[db, nowMs, onDelete, router],
	);
}
