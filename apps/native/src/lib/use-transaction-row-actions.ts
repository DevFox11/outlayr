import { useRouter } from "expo-router";
import { useCallback } from "react";

import type { ActionMenuItem } from "@/components/action-menu";
import type { TransactionWithCategory } from "@/data/transactions";
import { transactionsRepo } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import { transactionRowActions } from "@/domain/transaction-actions";
import { useTranslation } from "@/i18n/context";
import { translateNow } from "@/i18n/runtime";
import { notifyFailure } from "@/lib/notify";

import { transactionMenuItems } from "./transaction-actions";

/**
 * Never rejects: the menu is already dismissed when the write lands, so a silent
 * failure looks exactly like a stop that worked while the schedule is still live
 * — and the next foreground sweep then writes the very charge the user asked to
 * end. Say so instead, and keep the retry one tap away.
 */
async function stopRecurring(db: Database, id: string): Promise<void> {
    try {
        await transactionsRepo.stopRecurring(db, id);
    } catch (error) {
        console.error("Stop recurring failed", error);
        notifyFailure({
            actionLabel: translateNow("common.retry"),
            body: translateNow("transaction.stopRecurring.failedBody"),
            onActionPress: () => {
                // oxlint-disable-next-line no-void -- stopRecurring settles its own failure into this same toast, so the retry has no rejection left to handle
                void stopRecurring(db, id);
            },
            title: translateNow("transaction.stopRecurring.failedTitle"),
        });
    }
}

/**
 * Builds a row's context-menu entries. `future` says the row is being painted as
 * an upcoming occurrence, which the Delete guard needs and the row's own date
 * cannot tell it: a carrier's stored date is its last charge, not its next.
 *
 * The whole row is taken rather than an id, because a context menu is composed
 * before the press rather than assembled after one — which is also what retires
 * the read-back the imperative version needed.
 */
export function useTransactionRowActions(
    db: Database,
    nowMs: number,
    onDelete: (id: string) => void
): (transaction: TransactionWithCategory, future: boolean) => ActionMenuItem[] {
    const router = useRouter();
    const t = useTranslation();

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
                note: transaction.note,
                onDelete: () => onDelete(transaction.id),
                onEdit: () => router.push(`/transactions/${transaction.id}`),
                onLogAgain: () => router.push(`/transactions/create?from=${transaction.id}`),
                onStopRecurring: () => {
                    // oxlint-disable-next-line no-void -- stopRecurring never rejects — it surfaces its own toast and offers a retry — and the menu is already dismissed, so there is nothing to await
                    void stopRecurring(db, transaction.id);
                },
                pending: date.getTime() > now.getTime(),
                t,
            });
        },
        [db, nowMs, onDelete, router, t]
    );
}
