import { utcDateString } from "@outlayr/money/dates";
import { roundMoney } from "@outlayr/money/round";

import type { ReceiptDraft, ReceiptItem } from "@/lib/convex";

import { minorUnitsFor } from "./money";
import type { RateTable } from "./valuation";
import { spokenDateToLocal, uniqueMatch } from "./voice-entry";
import type { AccountCandidate, CategoryCandidate } from "./voice-entry";

/**
 * A read receipt with the ledger's own ids on it: what the review shows and
 * what the repo is handed. Names the model returned that this ledger cannot
 * resolve become nulls here, never guesses.
 */
export interface ResolvedReceipt {
    accountId: string | null;
    /** An account was named but did not resolve to exactly one; the form must ask which. */
    accountUnresolved: boolean;
    /** The grand total, in the receipt's currency, at that currency's minor units. */
    amount: number;
    categoryId: string | null;
    /** The category was picked from an incomplete set; the form must confirm it. */
    categoryUnresolved: boolean;
    currency: string;
    currencySource: "printed" | "inferred";
    /** The receipt printed a code the ledger cannot price; `currency` is the ledger's as a stand-in. */
    currencyUnresolved: boolean;
    date: Date;
    domain: string | null;
    income: boolean;
    items: ReceiptItem[];
    merchant: string;
    paymentMethod: string | null;
    subtotal: number | null;
    tax: number | null;
    tip: number | null;
}

interface ResolveArgs {
    accounts: readonly AccountCandidate[];
    /** The prompt did not carry every account, so a draft naming none may name one the model never saw. */
    accountsOmitted?: boolean;
    /** The prompt did not carry every category, so the model's pick came from an incomplete set. */
    categoriesOmitted?: boolean;
    categories: readonly CategoryCandidate[];
    /** The ledger's currency, for a receipt that names none. */
    currency: string;
    draft: ReceiptDraft;
    /** The instant the photo was sent — a receipt dated today keeps its time of day. */
    now: Date;
}

function roundLine(value: number | null, currency: string): number | null {
    return value === null ? null : roundMoney(value, minorUnitsFor(currency));
}

/**
 * The category is matched by folded name AND by direction: a refund filed
 * under "Groceries" names a real category on the wrong side of the ledger,
 * and that is a miss, not a match.
 */
export function resolveReceipt({
    accounts,
    accountsOmitted = false,
    categories,
    categoriesOmitted = false,
    currency,
    draft,
    now,
}: ResolveArgs): ResolvedReceipt {
    const paid = draft.currency ?? currency;
    const category = uniqueMatch(
        categories.filter((candidate) => candidate.income === draft.income),
        draft.categoryName,
        (candidate) => candidate.name
    );
    const account = uniqueMatch(accounts, draft.accountName, (candidate) => candidate.name);
    return {
        accountId: account?.id ?? null,
        accountUnresolved: draft.accountName === null ? accountsOmitted : account === null,
        amount: roundMoney(draft.total, minorUnitsFor(paid)),
        categoryId: category?.id ?? null,
        categoryUnresolved: categoriesOmitted,
        currency: paid,
        currencySource: draft.currencySource,
        currencyUnresolved: draft.currencyUnresolved,
        date: spokenDateToLocal(draft.date, now),
        domain: draft.domain,
        income: draft.income,
        items: draft.items.map((item) => ({ ...item, price: roundMoney(item.price, minorUnitsFor(paid)) })),
        merchant: draft.merchant,
        paymentMethod: draft.paymentMethod,
        subtotal: roundLine(draft.subtotal, paid),
        tax: roundLine(draft.tax, paid),
        tip: roundLine(draft.tip, paid),
    };
}

/**
 * A receipt the review may write as-is: a category this ledger has, an
 * amount that survived rounding, a merchant, no account the ledger could not
 * place (two share the name, or the prompt never carried it), and a currency
 * it can price. Anything less goes to the form, where the missing fact is a
 * slot to fill.
 */
export function savableReceipt(receipt: ResolvedReceipt): { categoryId: string } | null {
    const named = receipt.merchant.trim().length > 0;
    const placed = !(receipt.accountUnresolved || receipt.categoryUnresolved || receipt.currencyUnresolved);
    if (receipt.categoryId === null || receipt.amount <= 0 || !named || !placed) {
        return null;
    }
    return { categoryId: receipt.categoryId };
}

/** How many lines the notes keep before the rest folds into a count. */
export const DETAIL_LINES = 20;

/**
 * The itemisation as the notes field keeps it: one line per item, quantity
 * first when it is not one, the price right-aligned by nothing — notes are
 * prose, not a table. A long receipt keeps its first lines and says how many
 * more there were, so the notes stay readable in a row's detail.
 */
export function receiptDetails(
    receipt: ResolvedReceipt,
    formatPrice: (amount: number) => string,
    moreLabel: (count: number) => string
): string | null {
    if (receipt.items.length === 0) {
        return null;
    }
    const lines = receipt.items
        .slice(0, DETAIL_LINES)
        .map(
            (item) =>
                `${item.quantity === 1 ? "" : `${formatQuantity(item.quantity)}× `}${item.name} ${formatPrice(item.price)}`
        );
    const rest = receipt.items.length - DETAIL_LINES;
    if (rest > 0) {
        lines.push(moreLabel(rest));
    }
    return lines.join("\n");
}

/** "2", "1.5", never "1.500". */
export function formatQuantity(quantity: number): string {
    return String(Math.round(quantity * 1000) / 1000);
}

export interface Conversion {
    /** The total restated in the ledger's currency at the receipt day's rate. */
    amount: number;
    /** How many units of the ledger's currency one unit of the receipt's buys. */
    rate: number;
}

/**
 * What the receipt cost in the ledger's own currency, at the rate of the day
 * it was issued, or null when the table cannot say. The table is USD-based
 * (currency PER USD), so the receipt's currency is divided out and the
 * ledger's multiplied in; USD on either side is the identity leg.
 */
/** A stored rate is only usable as a divisor when it is a real, positive number. */
function usableRate(rate: number | null): rate is number {
    return rate !== null && Number.isFinite(rate) && rate > 0;
}

export function conversionOf(receipt: ResolvedReceipt, ledgerCurrency: string, rates: RateTable): Conversion | null {
    if (receipt.currency === ledgerCurrency) {
        return null;
    }
    const dateKey = utcDateString(receipt.date.getTime());
    const perUsdPaid = receipt.currency === "USD" ? 1 : rates.get(receipt.currency, dateKey);
    const perUsdLedger = ledgerCurrency === "USD" ? 1 : rates.get(ledgerCurrency, dateKey);
    // Both legs, and finite: `exchangeRates` stores a bare number, so a zero
    // ledger rate made `rate` zero and the review showed "0.00" as if that were a
    // real conversion, and a NaN passed a `<= 0` check outright. `perUsd` in
    // `transfer-rate-options.ts` and `usdOf` in `valuation.ts` both check the pair.
    if (!(usableRate(perUsdPaid) && usableRate(perUsdLedger))) {
        return null;
    }
    const rate = perUsdLedger / perUsdPaid;
    return {
        amount: roundMoney(receipt.amount * rate, minorUnitsFor(ledgerCurrency)),
        rate,
    };
}
