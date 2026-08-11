import { ENTRY_RATE_TYPES, type EntryRateType } from "@outlayr/money/rates";

export interface TransactionEntryRate {
	exchangeRate: number | null;
	exchangeRateType: EntryRateType;
}

export interface CanonicalRateFields {
	amountUsd?: number | null;
	exchangeRate?: number | null;
	exchangeRateType?: string | null;
}

export type TransactionRateError = "customRateRequired" | "eurReferenceRequiresVes" | null;

export function transactionRateOptions(currency: string): EntryRateType[] {
	if (currency === "USD") {
		return [];
	}

	return ENTRY_RATE_TYPES.filter((rateType) => rateType !== "eur_reference" || currency === "VES");
}

export function transactionRateError(currency: string, selection: TransactionEntryRate): TransactionRateError {
	if (selection.exchangeRateType === "eur_reference" && currency !== "VES") {
		return "eurReferenceRequiresVes";
	}

	if (
		selection.exchangeRateType === "custom" &&
		(selection.exchangeRate === null || !Number.isFinite(selection.exchangeRate) || selection.exchangeRate <= 0)
	) {
		return "customRateRequired";
	}

	return null;
}

export function isTransactionRateNeeded(fields: CanonicalRateFields): boolean {
	return fields.amountUsd === null && fields.exchangeRate === null && fields.exchangeRateType === "custom";
}
