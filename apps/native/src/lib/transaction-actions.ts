import { Alert, type AlertButton } from "react-native";
import {
	stopRecurringPrompt,
	type TransactionRowActions,
} from "@/domain/transaction-actions";
import { translateNow } from "@/i18n/runtime";

interface TransactionActionsOptions {
	note: string;
	actions: TransactionRowActions;
	/** The row is the charge still to land rather than one already logged. */
	pending: boolean;
	onStopRecurring: () => void;
	onLogAgain: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

export function confirmStopRecurring(
	note: string,
	pending: boolean,
	onConfirm: () => void,
): void {
	const {
		titleKey,
		messageKey,
		note: named,
	} = stopRecurringPrompt(note, pending);
	Alert.alert(
		translateNow(titleKey, { note: named ?? undefined }),
		translateNow(messageKey),
		[
			{ text: translateNow("common.cancel"), style: "cancel" },
			{
				text: translateNow("alerts.transaction.stopRecurring"),
				style: "destructive",
				onPress: onConfirm,
			},
		],
	);
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
			text: translateNow("alerts.transaction.logAgain"),
			onPress: onLogAgain,
		});
	}
	if (actions.canStopRecurring) {
		buttons.push({
			text: translateNow("alerts.transaction.stopRecurring"),
			onPress: () => confirmStopRecurring(note, pending, onStopRecurring),
		});
	}
	buttons.push({ text: translateNow("common.edit"), onPress: onEdit });
	if (actions.canDelete) {
		buttons.push({
			text: translateNow("common.delete"),
			style: "destructive",
			onPress: onDelete,
		});
	}
	buttons.push({ text: translateNow("common.cancel"), style: "cancel" });

	Alert.alert(
		note.trim() || translateNow("alerts.transaction.fallbackTitle"),
		undefined,
		buttons,
	);
}
