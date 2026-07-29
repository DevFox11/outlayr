import { Alert } from "react-native";
import { translateNow } from "@/i18n/runtime";

interface BudgetActionsOptions {
	/** Category name for a per-category budget; omit for the overall budget. */
	name?: string | null;
	onEdit: () => void;
	onDelete: () => void;
}

/** Swift's `DeleteBudgetConfirmation` / `DeleteMainBudgetConfirmation` copy. */
function deleteTitle(name?: string | null): string {
	const named = name?.trim();
	return named
		? translateNow("alerts.budget.deleteNamed", { name: named })
		: translateNow("alerts.budget.deleteOverall");
}

export function confirmDeleteBudget(
	name: string | null | undefined,
	onConfirm: () => void,
): void {
	Alert.alert(deleteTitle(name), translateNow("alerts.budget.irreversible"), [
		{ text: translateNow("common.cancel"), style: "cancel" },
		{
			text: translateNow("common.delete"),
			style: "destructive",
			onPress: onConfirm,
		},
	]);
}

/** Mirrors `SingleBudgetView`'s `contextMenu` in Swift. */
export function showBudgetActions({
	name,
	onEdit,
	onDelete,
}: BudgetActionsOptions): void {
	Alert.alert(
		name?.trim() ? name.trim() : translateNow("alerts.budget.fallbackTitle"),
		undefined,
		[
			{ text: translateNow("common.edit"), onPress: onEdit },
			{
				text: translateNow("common.delete"),
				style: "destructive",
				onPress: () => confirmDeleteBudget(name, onDelete),
			},
			{ text: translateNow("common.cancel"), style: "cancel" },
		],
	);
}
