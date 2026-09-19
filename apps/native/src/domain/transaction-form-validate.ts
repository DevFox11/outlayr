import type { EntryRateType } from "@outlayr/money/rates";

import { numpadToNumber } from "./numpad";
import { transactionRateError } from "./transaction-entry-rate";

export const TRANSACTION_FORM_ERROR = {
    amountRequired: "amountRequired",
    categoryRequired: "categoryRequired",
    customRateRequired: "customRateRequired",
    eurReferenceRequiresVes: "eurReferenceRequiresVes",
} as const;

export interface TransactionFormCategoryValues {
    readonly category: unknown;
    readonly pendingCategory: unknown;
}

export interface TransactionFormValidationValues extends TransactionFormCategoryValues {
    readonly amount: string;
    readonly categoryDeferred?: boolean;
    readonly currency: string;
    readonly exchangeRate: number | null;
    readonly exchangeRateType: EntryRateType | null;
}

export interface TransactionFormFieldErrors {
    amount?: string;
    category?: string;
    exchangeRate?: string;
}

export function isMissingCategory(value: TransactionFormCategoryValues): boolean {
    return value.category == null && value.pendingCategory == null;
}

export function transactionFormErrors(
    value: TransactionFormValidationValues
): { fields: TransactionFormFieldErrors } | null {
    const fields: TransactionFormFieldErrors = {};
    if (numpadToNumber(value.amount) <= 0) {
        fields.amount = TRANSACTION_FORM_ERROR.amountRequired;
    }
    if (isMissingCategory(value) && value.categoryDeferred !== true) {
        fields.category = TRANSACTION_FORM_ERROR.categoryRequired;
    }
    if (value.currency !== "USD") {
        const rateError = transactionRateError(value.currency, {
            exchangeRate: value.exchangeRate,
            exchangeRateType: value.exchangeRateType ?? "official",
        });
        if (rateError !== null) {
            fields.exchangeRate = TRANSACTION_FORM_ERROR[rateError];
        }
    }
    return fields.amount === undefined && fields.category === undefined && fields.exchangeRate === undefined
        ? null
        : { fields };
}
