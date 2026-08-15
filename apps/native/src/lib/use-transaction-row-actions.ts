import { useRouter } from "expo-router";
import { useCallback } from "react";

import type { ActionMenuItem } from "@/components/action-menu";
import type { TransactionWithCategory } from "@/data/transactions";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { transactionRowActions } from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n/context";

import { transactionMenuItems } from "./transaction-actions";

/**
 * Builds a row's context-menu entries. `future` says the row is being painted as
 * an upcoming occurrence, which the Delete guard needs and the row's own date
 * cannot tell it: a carrier's stored date is its last charge, not its next.
 *
 * The whole row is taken rather than an id, because a context menu is composed
 * before the press rather than assembled after one — which is also what retires
 * the read-back the imperative version needed.
 *
 * Stopping a schedule is held for an undo window like the delete beside it. It
 * has to be: the write is the only record that the schedule ended, and a silent
 * failure looks exactly like a stop that worked while the schedule is still live
 * — the next foreground sweep then writes the very charge the user asked to end.
 * The window's toast says so either way.
 */
export function useTransactionRowActions(
    nowMs: number,
    onDelete: (id: string) => void
): (transaction: TransactionWithCategory, future: boolean) => ActionMenuItem[] {
    const router = useRouter();
    const t = useTranslation();
    const { requestDelete: requestStopRecurring } = useDeferredDelete("recurring");

    return useCallback(
        (transaction: TransactionWithCategory, future: boolean) => {
            const now = new Date(nowMs);
            const date = new Date(transaction.date);
            return transactionMenuItems({
                actions: transactionRowActions({
                    date,
                    future,
                    now,
                    recurringType: transaction.recurringType,
                }),
                onDelete: () => onDelete(transaction.id),
                onEdit: () => router.push(`/transactions/${transaction.id}`),
                onLogAgain: () => router.push(`/transactions/create?from=${transaction.id}`),
                onStopRecurring: () => requestStopRecurring(transaction.id),
                t,
            });
        },
        [nowMs, onDelete, requestStopRecurring, router, t]
    );
}
