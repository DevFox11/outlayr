import { Alert } from "react-native";
import type { AlertButton } from "react-native";

import { stopRecurringPrompt } from "@/domain/transaction-actions";
import type { TransactionRowActions } from "@/domain/transaction-actions";
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
 * a second ask for the same permission.
 */
export function showTransactionActions({
    note,
    actions,
    pending,
    onStopRecurring,
    onLogAgain,
    onEdit,
    onDelete,
}: TransactionActionsOptions): void {
    const buttons: AlertButton[] = [];
    if (actions.canLogAgain) {
        buttons.push({
            onPress: onLogAgain,
            text: translateNow("alerts.transaction.logAgain"),
        });
    }
    if (actions.canStopRecurring) {
        buttons.push({
            onPress: () => confirmStopRecurring(note, pending, onStopRecurring),
            text: translateNow("alerts.transaction.stopRecurring"),
        });
    }
    buttons.push({ onPress: onEdit, text: translateNow("common.edit") });
    if (actions.canDelete) {
        buttons.push({
            onPress: onDelete,
            style: "destructive",
            text: translateNow("common.delete"),
        });
    }
    buttons.push({ style: "cancel", text: translateNow("common.cancel") });

    Alert.alert(note.trim() || translateNow("alerts.transaction.fallbackTitle"), undefined, buttons);
}
