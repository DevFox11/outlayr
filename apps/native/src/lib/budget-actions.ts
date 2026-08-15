import type { ActionMenuItem } from "@/components/action-menu";
import type { TranslateFn } from "@/i18n/context";

interface BudgetActionsOptions {
    onDelete: () => void;
    onEdit: () => void;
    t: TranslateFn;
}

/**
 * Mirrors `SingleBudgetView`'s `contextMenu` in Swift. Built for an `ActionMenu`
 * rather than shown outright: the choice belongs on the budget the user is
 * holding. Delete carries no confirmation of its own — it routes through the undo
 * window, and a dialog in front of an undoable action is a second ask for the
 * same permission.
 */
export function budgetMenuItems({ onEdit, onDelete, t }: BudgetActionsOptions): ActionMenuItem[] {
    return [
        { icon: "pencil", id: "edit", label: t("common.edit"), onPress: onEdit },
        {
            destructive: true,
            icon: "trash",
            id: "delete",
            label: t("common.delete"),
            onPress: onDelete,
        },
    ];
}
