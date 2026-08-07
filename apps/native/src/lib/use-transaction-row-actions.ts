import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { getTransactionById, transactionsRepo } from "@/data/transactions";
import type { Database } from "@/db/client";
import { transactionRowActions } from "@/domain/transaction-actions";
import { translateNow } from "@/i18n/runtime";
import { showTransactionActions } from "./transaction-actions";

/**
 * Never rejects: the action sheet is already dismissed when the write lands, so
 * a silent failure looks exactly like a stop that worked while the schedule is
 * still live — and the next foreground sweep then writes the very charge the
 * user asked to end. Say so instead, and keep the retry one tap away.
 */
async function stopRecurring(db: Database, id: string): Promise<void> {
	try {
		await transactionsRepo.stopRecurring(db, id);
	} catch (error) {
		console.error("Stop recurring failed", error);
		Alert.alert(
			translateNow("transaction.stopRecurring.failedTitle"),
			translateNow("transaction.stopRecurring.failedBody"),
			[
				{ text: translateNow("common.cancel"), style: "cancel" },
				{
					text: translateNow("common.retry"),
					onPress: () => {
						void stopRecurring(db, id);
					},
				},
			],
		);
	}
}

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
					void stopRecurring(db, id);
				},
				onLogAgain: () => router.push(`/transactions/create?from=${id}`),
				onEdit: () => router.push(`/transactions/${id}`),
				onDelete: () => onDelete(id),
			});
		},
		[db, nowMs, onDelete, router],
	);
}
