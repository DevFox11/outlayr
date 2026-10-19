import { isPerson, toAccountKind } from "@outlayr/money/account-kind";
import { decimalsFor } from "@outlayr/money/currency";

import type { PaymentSource } from "@/data/installments-core";

/**
 * What leaves `from` to put `amount` on an order owed in `toCurrency`, the way
 * the transfer editor stores a move between currencies: the source leg rounded
 * to its own minor units, the rate as destination per source, typed `official`.
 * Null when the currencies differ and the day has no rate to convert at.
 */
export function paymentSource(
    amount: number,
    from: { currency: string; id: string },
    toCurrency: string,
    rate: number | null
): PaymentSource | null {
    if (from.currency === toCurrency) {
        return {
            exchangeRate: 1,
            exchangeRateType: null,
            fromAccountId: from.id,
            fromAmount: amount,
            fromCurrency: from.currency,
        };
    }
    if (rate === null || !(rate > 0)) {
        return null;
    }
    const scale = 10 ** decimalsFor(from.currency);
    return {
        exchangeRate: rate,
        exchangeRateType: "official",
        fromAccountId: from.id,
        fromAmount: Math.round((amount / rate) * scale) / scale,
        fromCurrency: from.currency,
    };
}

/**
 * The accounts a payment toward an order can come from: banks first, then
 * cards and loans, which pay it the way a card pays anything (their debt goes
 * up as the order's goes down). Never the order's own account, never a person.
 */
export function paymentSources<T extends { readonly id: string; readonly kind: string }>(
    accounts: readonly T[],
    planAccountId: string | undefined
): T[] {
    const offered = accounts.filter((account) => account.id !== planAccountId && !isPerson(account));
    const card = (account: T) => toAccountKind(account.kind) === "liability";
    return [...offered.filter((account) => !card(account)), ...offered.filter(card)];
}
