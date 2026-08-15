import { Alert } from "react-native";

import type { ActionMenuItem } from "@/components/action-menu";
import type { TranslateFn } from "@/i18n/context";
import { translateNow } from "@/i18n/runtime";

interface BudgetActionsOptions {
    /** Category name for a per-category budget; omit for the overall budget. */
    name?: string | null;
    onDelete: () => void;
    onEdit: () => void;
    t: TranslateFn;
}

/** Swift's `DeleteBudgetConfirmation` / `DeleteMainBudgetConfirmation` copy. */
function deleteTitle(name?: string | null): string {
    const named = name?.trim();
    return named
        ? translateNow("alerts.budget.deleteNamed", { name: named })
        : translateNow("alerts.budget.deleteOverall");
}

export function confirmDeleteBudget(name: string | null | undefined, onConfirm: () => void): void {
    Alert.alert(deleteTitle(name), translateNow("alerts.budget.irreversible"), [
        { style: "cancel", text: translateNow("common.cancel") },
        {
            onPress: onConfirm,
            style: "destructive",
            text: translateNow("common.delete"),
        },
    ]);
}

/**
 * Mirrors `SingleBudgetView`'s `contextMenu` in Swift. Built for an `ActionMenu`
 * rather than shown outright: the choice belongs on the budget the user is
 * holding, and the delete keeps its own confirmation because it is the one entry
 * here that no undo window catches.
 */
export function budgetMenuItems({ name, onEdit, onDelete, t }: BudgetActionsOptions): ActionMenuItem[] {
    return [
        { icon: "pencil", id: "edit", label: t("common.edit"), onPress: onEdit },
        {
            destructive: true,
            icon: "trash",
            id: "delete",
            label: t("common.delete"),
            onPress: () => confirmDeleteBudget(name, onDelete),
        },
    ];
}
