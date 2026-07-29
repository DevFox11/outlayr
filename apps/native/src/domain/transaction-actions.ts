import type { TranslationKey } from "@/i18n/catalog";
import { RECURRING_TYPE } from "./recurrence";

export interface TransactionRowActionContext {
	recurringType: number;
	/** The row's stored date, which for a carrier is its last charge, not its next. */
	date: Date;
	/** True when the row is painted as an upcoming occurrence. */
	future: boolean;
	now: Date;
}

export interface TransactionRowActions {
	canStopRecurring: boolean;
	canDelete: boolean;
}

/** Mirrors the guards on `SingleTransactionView`'s `contextMenu` in Swift. */
export function transactionRowActions({
	recurringType,
	date,
	future,
	now,
}: TransactionRowActionContext): TransactionRowActions {
	const live = recurringType > RECURRING_TYPE.none;
	return {
		canStopRecurring: live,
		// A live carrier whose own date has passed is standing in Upcoming for a
		// charge that has not been written yet, so deleting it there reads as
		// "drop this row" while actually ending the subscription. Stop Recurring
		// states that intent outright, and Delete steps aside rather than compete.
		canDelete: !(future && live && date.getTime() < now.getTime()),
	};
}

export interface ConfirmCopy {
	titleKey: TranslationKey;
	messageKey: TranslationKey;
	/** Interpolated into `titleKey` when the row carries a note. */
	note: string | null;
}

/**
 * `pending` separates the two shapes a carrier takes: a future-dated row is the
 * next charge itself and still lands, while a past-dated one is already on the
 * ledger and only its schedule goes.
 */
export function stopRecurringPrompt(
	note: string,
	pending: boolean,
): ConfirmCopy {
	const named = note.trim();
	return {
		titleKey: named
			? "alerts.transaction.stopNamed"
			: "alerts.transaction.stopUnnamed",
		messageKey: pending
			? "alerts.transaction.stopPending"
			: "alerts.transaction.stopSettled",
		note: named || null,
	};
}
