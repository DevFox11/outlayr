import type { ActionMenuItem } from "@/components/action-menu";
import type { TranslateFn } from "@/i18n/context";

interface BudgetActionsOptions {
    onChangeLimit: () => void;
    onDelete: () => void;
    t: TranslateFn;
}

/**
 * Built for an `ActionMenu` rather than shown outright: the choice belongs on the
 * budget the user is holding. The limit is the fact a card offers, because every
 * other one is a row on the budget's own screen, which a tap already opens.
 * Delete carries no confirmation of its own — it routes through the undo window,
 * and a dialog in front of an undoable action is a second ask for the same
 * permission.
 */
export function budgetMenuItems({ onChangeLimit, onDelete, t }: BudgetActionsOptions): ActionMenuItem[] {
    return [
        { icon: "pencil", id: "limit", label: t("budgets.action.changeLimit"), onPress: onChangeLimit },
        {
            destructive: true,
            icon: "trash",
            id: "delete",
            label: t("common.delete"),
            onPress: onDelete,
        },
    ];
}
