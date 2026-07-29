import { Alert } from "react-native";

interface BudgetActionsOptions {
	/** Category name for a per-category budget; omit for the overall budget. */
	name?: string | null;
	onEdit: () => void;
	onDelete: () => void;
}

/** Swift's `DeleteBudgetConfirmation` / `DeleteMainBudgetConfirmation` copy. */
function deleteTitle(name?: string | null): string {
	return name?.trim()
		? `Delete the '${name.trim()}' budget?`
		: "Delete the overall budget?";
}

export function confirmDeleteBudget(
	name: string | null | undefined,
	onConfirm: () => void,
): void {
	Alert.alert(deleteTitle(name), "This action cannot be undone.", [
		{ text: "Cancel", style: "cancel" },
		{ text: "Delete", style: "destructive", onPress: onConfirm },
	]);
}

/** Mirrors `SingleBudgetView`'s `contextMenu` in Swift. */
export function showBudgetActions({
	name,
	onEdit,
	onDelete,
}: BudgetActionsOptions): void {
	Alert.alert(name?.trim() ? name.trim() : "Overall Budget", undefined, [
		{ text: "Edit", onPress: onEdit },
		{
			text: "Delete",
			style: "destructive",
			onPress: () => confirmDeleteBudget(name, onDelete),
		},
		{ text: "Cancel", style: "cancel" },
	]);
}
