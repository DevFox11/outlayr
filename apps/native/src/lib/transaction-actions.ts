import type { ActionMenuItem } from "@/components/action-menu";
import type { TransactionRowActions } from "@/domain/transaction-actions";
import type { TranslateFn } from "@/i18n/context";

interface TransactionActionsOptions {
    actions: TransactionRowActions;
    onDelete: () => void;
    onEdit: () => void;
    onLogAgain: () => void;
    onStopRecurring: () => void;
    t: TranslateFn;
}

/**
 * Mirrors `SingleTransactionView`'s `contextMenu` in Swift.
 *
 * Neither Delete nor Stop Recurring carries a confirmation of its own: both
 * route through the undo window the swipe action already uses, and a dialog in
 * front of an undoable action is a second ask for the same permission.
 */
export function transactionMenuItems({
    actions,
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
            onPress: onStopRecurring,
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
