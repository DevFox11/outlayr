import { numpadToNumber } from "./numpad";

export const TRANSACTION_FORM_ERROR = {
	amountRequired: "amountRequired",
	categoryRequired: "categoryRequired",
} as const;

export interface TransactionFormCategoryValues {
	readonly category: unknown;
	readonly pendingCategory: unknown;
}

export interface TransactionFormValidationValues
	extends TransactionFormCategoryValues {
	readonly amount: string;
}

export interface TransactionFormFieldErrors {
	amount?: string;
	category?: string;
}

export function isMissingCategory(
	value: TransactionFormCategoryValues,
): boolean {
	return value.category == null && value.pendingCategory == null;
}

export function transactionFormErrors(
	value: TransactionFormValidationValues,
): { fields: TransactionFormFieldErrors } | null {
	const fields: TransactionFormFieldErrors = {};
	if (numpadToNumber(value.amount) <= 0) {
		fields.amount = TRANSACTION_FORM_ERROR.amountRequired;
	}
	if (isMissingCategory(value)) {
		fields.category = TRANSACTION_FORM_ERROR.categoryRequired;
	}
	return fields.amount === undefined && fields.category === undefined
		? null
		: { fields };
}
