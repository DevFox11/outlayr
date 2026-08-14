import type { TranslateFn } from "@/i18n/context";

import { formatAmount } from "./money";

export interface RowAmountLabelInput {
    amount: number;
    code: string;
    income: boolean | null;
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
    t: TranslateFn
): string {
    const amountText = formatAmount(amount, code, showCents);
    // Null is a transfer: neither wording fits money that was only moved, and a
    // screen reader has no colour or glyph to fall back on.
    if (income === null) {
        return t("log.row.amountTransfer", { amount: amountText });
    }
    return t(income ? "log.row.amountIncome" : "log.row.amountExpense", {
        amount: amountText,
    });
}
