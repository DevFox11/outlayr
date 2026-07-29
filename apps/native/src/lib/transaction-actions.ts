import { Alert, type AlertButton } from "react-native";
import {
	stopRecurringPrompt,
	type TransactionRowActions,
} from "@/domain/transaction-actions";

interface TransactionActionsOptions {
	note: string;
	actions: TransactionRowActions;
	/** The row is the charge still to land rather than one already logged. */
	pending: boolean;
	onStopRecurring: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

export function confirmStopRecurring(
	note: string,
	pending: boolean,
	onConfirm: () => void,
): void {
	const { title, message } = stopRecurringPrompt(note, pending);
	Alert.alert(title, message, [
		{ text: "Cancel", style: "cancel" },
		{ text: "Stop Recurring", style: "destructive", onPress: onConfirm },
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
	onEdit,
	onDelete,
}: TransactionActionsOptions): void {
	const buttons: AlertButton[] = [];
	if (actions.canStopRecurring) {
		buttons.push({
			text: "Stop Recurring",
			onPress: () => confirmStopRecurring(note, pending, onStopRecurring),
		});
	}
	buttons.push({ text: "Edit", onPress: onEdit });
	if (actions.canDelete) {
		buttons.push({ text: "Delete", style: "destructive", onPress: onDelete });
	}
	buttons.push({ text: "Cancel", style: "cancel" });

	Alert.alert(note.trim() || "Transaction", undefined, buttons);
}
