import type { TranslateFn } from "@/i18n/context";
import { formatAmount } from "./money";

export interface RowAmountLabelInput {
	amount: number;
	income: boolean;
	code: string;
	/** Mirrors the "Display Cents" setting; false rounds to whole units. */
	showCents?: boolean;
}

/**
 * The accessible name for a ledger row's amount: the direction as a word, then
 * the magnitude. The row's own currency mark rides along inside the formatted
 * amount, matching what the row prints.
 */
export function rowAmountLabel(
	{ amount, income, code, showCents = true }: RowAmountLabelInput,
	t: TranslateFn,
): string {
	return t(income ? "log.row.amountIncome" : "log.row.amountExpense", {
		amount: formatAmount(amount, code, showCents),
	});
}
