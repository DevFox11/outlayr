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
	canLogAgain: boolean;
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
		// "Again" presupposes a first time. A row painted as upcoming is money that
		// has not moved, so there is nothing to repeat there yet. Every settled row
		// qualifies, a schedule's carrier included: what the copy takes is that
		// row's charge, and the schedule is precisely what it leaves behind.
		canLogAgain: !future,
	};
}

/**
 * A logged charge as `Log again` hands it to a fresh form. Narrower than the row
 * it is read off, and each omission is load-bearing:
 *
 * - No cadence and no reminder lead. Repeating one charge of a subscription must
 *   not mint a second schedule, which the next sweep would walk forward into a
 *   chain of its own — the same hazard the save path guards.
 * - No date. That the purchase is happening now is the whole point of the action.
 * - No photo. `imageUri` is a path into this device's container and `imageKey`
 *   owns the stored bytes, so two rows sharing one photo identity would let a
 *   delete on either release the other's picture.
 */
export interface LogAgainDraft {
	amount: number;
	income: boolean;
	categoryId: string | null;
	note: string;
	details: string | null;
	currency: string | null;
	icon: string | null;
	emoji: string | null;
	customColor: string | null;
}

/**
 * Projects a logged row onto {@link LogAgainDraft}. Named field by field rather
 * than spread-and-delete, so a column added to the table joins the copy only
 * when someone decides here that it should.
 */
export function logAgainDraft(source: LogAgainDraft): LogAgainDraft {
	return {
		amount: source.amount,
		income: source.income,
		categoryId: source.categoryId,
		note: source.note,
		details: source.details,
		currency: source.currency,
		icon: source.icon,
		emoji: source.emoji,
		customColor: source.customColor,
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
