import { CURRENCY_META, PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";
import { METAL_CURRENCY_CODES } from "@outlayr/money/currency";
import { ENTRY_RATE_TYPES } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";

import { currencySymbol, formatFixed } from "@/domain/money";
import type { Language } from "@/i18n/languages";

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

function quoteRank(code: string): number {
    if (QUOTED_IN_USD.has(code)) {
        return 2;
    }
    return code === "USD" ? 1 : 0;
}

function pairQuotedInverse(from: string, to: string): boolean {
    return quoteRank(to) > quoteRank(from);
}

export function quotePairRate(from: string, to: string, rate: number): number {
    return pairQuotedInverse(from, to) ? 1 / rate : rate;
}

export function flipRateForQuote(currency: string, rate: number): number {
    return rate > 0 ? quotePairRate("USD", currency, rate) : rate;
}

const SHARED_SYMBOLS: ReadonlySet<string> = new Set(
    PICKABLE_CURRENCY_CODES.map((code) => CURRENCY_META[code].symbol).filter(
        (symbol, index, symbols) => symbols.indexOf(symbol) !== index
    )
);

const SYMBOL_OWNERS = new Map([
    ["$", "USD"],
    ["£", "GBP"],
    ["₩", "KRW"],
]);

function unitSymbol(code: string): string {
    const symbol = currencySymbol(code);
    return SHARED_SYMBOLS.has(symbol) && SYMBOL_OWNERS.get(symbol) !== code ? code : symbol;
}

export function pairUnitSymbols(from: string, to: string) {
    return pairQuotedInverse(from, to)
        ? { base: unitSymbol(to), quote: unitSymbol(from) }
        : { base: unitSymbol(from), quote: unitSymbol(to) };
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

export const RATE_ENTRY_DECIMALS = 4;

export function rateEntryText(rate: number): string {
    const rounded = Number(rate.toFixed(RATE_ENTRY_DECIMALS));
    return rounded > 0 ? String(rounded) : "";
}

/**
 * Display form of a rate. Providers quote at wildly different precisions (VES official
 * arrives at 4 decimals, the EUR reference leg at 8), and an 11-digit figure is unreadable
 * at heading size. Callers must still apply the UNROUNDED rate: this is display only.
 */
export function formatQuotedRate(currency: string, rate: number): string {
    return rateEntryText(flipRateForQuote(currency, rate));
}

export function formatEnteredRate(rate: number, language?: Language): string {
    const [, fraction = ""] = rateEntryText(rate).split(".");
    return formatFixed(rate, fraction.length, language);
}

const RATE_SIGNIFICANT_DIGITS = 5;

const RATE_MAX_DECIMALS = 10;

export function formatRateFigure(rate: number, language?: Language): string {
    const decimals = Math.min(
        RATE_MAX_DECIMALS,
        Math.max(0, RATE_SIGNIFICANT_DIGITS - (Math.floor(Math.log10(rate)) + 1))
    );
    return formatFixed(rate, decimals, language);
}

export function formatQuotedRateFigure(currency: string, rate: number, language?: Language): string {
    return formatRateFigure(flipRateForQuote(currency, rate), language);
}

export function rateDeltaPercent(currency: string, rate: number, reference: number): number {
    return (flipRateForQuote(currency, rate) / flipRateForQuote(currency, reference) - 1) * 100;
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
