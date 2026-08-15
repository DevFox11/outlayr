import { Alert } from "react-native";

import type { ActionMenuItem } from "@/components/action-menu";
import { stopRecurringPrompt } from "@/domain/transaction-actions";
import type { TransactionRowActions } from "@/domain/transaction-actions";
import type { TranslateFn } from "@/i18n/context";
import { translateNow } from "@/i18n/runtime";

interface TransactionActionsOptions {
    actions: TransactionRowActions;
    note: string;
    onDelete: () => void;
    onEdit: () => void;
    onLogAgain: () => void;
    onStopRecurring: () => void;
    /** The row is the charge still to land rather than one already logged. */
    pending: boolean;
    t: TranslateFn;
}

export function confirmStopRecurring(note: string, pending: boolean, onConfirm: () => void): void {
    const { titleKey, messageKey, note: named } = stopRecurringPrompt(note, pending);
    Alert.alert(translateNow(titleKey, { note: named ?? undefined }), translateNow(messageKey), [
        { style: "cancel", text: translateNow("common.cancel") },
        {
            onPress: onConfirm,
            style: "destructive",
            text: translateNow("alerts.transaction.stopRecurring"),
        },
    ]);
}

/**
 * Mirrors `SingleTransactionView`'s `contextMenu` in Swift.
 *
 * Delete carries no confirmation of its own: it routes through the undo window
 * the swipe action already uses, and a dialog in front of an undoable action is
 * a second ask for the same permission. Stop Recurring keeps one, because ending
 * a schedule is what nothing here can undo.
 */
export function transactionMenuItems({
    note,
    actions,
    pending,
    onStopRecurring,
    onLogAgain,
    onEdit,
    onDelete,
    t,
}: TransactionActionsOptions): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    if (actions.canLogAgain) {
        items.push({
            icon: "doc.on.doc",
            id: "logAgain",
            label: t("alerts.transaction.logAgain"),
            onPress: onLogAgain,
        });
    }
    if (actions.canStopRecurring) {
        items.push({
            icon: "calendar.badge.minus",
            id: "stopRecurring",
            label: t("alerts.transaction.stopRecurring"),
            onPress: () => confirmStopRecurring(note, pending, onStopRecurring),
        });
    }
    items.push({ icon: "pencil", id: "edit", label: t("common.edit"), onPress: onEdit });
    if (actions.canDelete) {
        items.push({
            destructive: true,
            icon: "trash",
            id: "delete",
            label: t("common.delete"),
            onPress: onDelete,
        });
    }
    return items;
}
