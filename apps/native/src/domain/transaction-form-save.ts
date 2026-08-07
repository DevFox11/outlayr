import type { TransactionInput } from "@/data/transactions-core";
import { RECURRING_TYPE } from "./recurrence";

export interface TransactionSaveDraft {
	amount: number;
	income: boolean;
	categoryId: string;
	note: string;
	details: string;
	date: Date;
	currency: string | null;
	icon: string | null;
	emoji: string | null;
	customColor: string | null;
	imageUri: string | null;
	imageColor: string | null;
	isSubscription: boolean;
	recurringType: number;
	coefficient: number;
	hasEndDate: boolean;
	endDate: Date;
	leadDays: number | null;
	accountId: string | null;
}

/**
 * A one-off carries no schedule regardless of what the (hidden) cadence
 * fields still hold — `isSubscription` is the single gate, not each field
 * independently, so a row switched back to "once" can never resurrect a
 * lead or end date left over from before the toggle.
 */
export function buildTransactionInput(
	draft: TransactionSaveDraft,
): TransactionInput {
	return {
		amount: draft.amount,
		income: draft.income,
		categoryId: draft.categoryId,
		note: draft.note,
		details: draft.details,
		date: draft.date,
		currency: draft.currency,
		icon: draft.icon,
		emoji: draft.emoji,
		customColor: draft.customColor,
		imageUri: draft.imageUri,
		imageColor: draft.imageColor,
		onceRecurring: draft.isSubscription,
		recurringType: draft.isSubscription
			? draft.recurringType
			: RECURRING_TYPE.none,
		recurringCoefficient: draft.isSubscription
			? Math.max(1, draft.coefficient)
			: 1,
		recurringEndDate:
			draft.isSubscription && draft.hasEndDate ? draft.endDate : null,
		reminderLeadDays: draft.isSubscription ? draft.leadDays : null,
		accountId: draft.accountId,
	};
}
