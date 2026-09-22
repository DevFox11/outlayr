import { METAL_CURRENCY_CODES } from "@outlayr/money/currency";
import { ENTRY_RATE_TYPES } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";

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

const QUOTED_IN_USD: ReadonlySet<string> = new Set([
    "AUD",
    "EUR",
    "FKP",
    "GBP",
    "GGP",
    "GIP",
    "IMP",
    "JEP",
    "NZD",
    "SHP",
    ...METAL_CURRENCY_CODES,
]);

export function rateQuoteUnit(currency: string): { base: string; quote: string } {
    return QUOTED_IN_USD.has(currency) ? { base: currency, quote: "USD" } : { base: "USD", quote: currency };
}

export function flipRateForQuote(currency: string, rate: number): number {
    return QUOTED_IN_USD.has(currency) && rate > 0 ? 1 / rate : rate;
}

export function transactionRateOptions(currency: string): EntryRateType[] {
    if (currency === "USD") {
        return [];
    }

    return ENTRY_RATE_TYPES.filter((rateType) => rateType !== "eur_reference" || currency === "VES");
}

/**
 * The rate the entry will actually be recorded at. An explicit `exchangeRate` always
 * wins; otherwise a provider-backed type falls back to its suggestion, because selecting
 * "official" without applying the suggestion still records the official rate. Custom has
 * no fallback: with no rate entered there is nothing to convert at.
 */
export function effectiveEntryRate(
    selection: TransactionEntryRate,
    suggestions: { eurReference: number | null; official: number | null }
): number | null {
    if (selection.exchangeRate !== null && Number.isFinite(selection.exchangeRate) && selection.exchangeRate > 0) {
        return selection.exchangeRate;
    }
    if (selection.exchangeRateType === "official") {
        return suggestions.official;
    }
    return selection.exchangeRateType === "eur_reference" ? suggestions.eurReference : null;
}

/**
 * Display form of a rate. Providers quote at wildly different precisions (VES official
 * arrives at 4 decimals, the EUR reference leg at 8), and an 11-digit figure is unreadable
 * at heading size. Callers must still apply the UNROUNDED rate: this is display only.
 */
export function formatEntryRate(rate: number): string {
    return String(Number(rate.toFixed(4)));
}

export function formatQuotedRate(currency: string, rate: number): string {
    return formatEntryRate(flipRateForQuote(currency, rate));
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
