import { dinero, toDecimal, USD } from "dinero.js/bigint";

import { MoneyValidationError } from "./errors";
import { DECIMAL_RADIX, divideHalfEven, toScaledInt, USD_SCALE } from "./scaled-int";
import type { ScaledInt } from "./scaled-int";

/** `binance` is VES-per-USDT market data only — never an entry type. */
export const MARKET_RATE_TYPES = ["official", "eur_reference", "binance"] as const;

/**
 * Deliberately diverges from `MARKET_RATE_TYPES`: `binance` is excluded
 * (USDT != USD), `custom` is added for user-supplied operation rates.
 */
export const ENTRY_RATE_TYPES = ["official", "eur_reference", "custom"] as const;

export type MarketRateType = (typeof MARKET_RATE_TYPES)[number];
export type EntryRateType = (typeof ENTRY_RATE_TYPES)[number];

export interface RateRow {
    date: string;
    rate: number;
}

/** Must return the newest row on or before `date`, else `null`. */
export type RateLookup = (quote: string, rateType: MarketRateType, date: string) => Promise<RateRow | null>;

/**
 * - `eur_reference` is VES-only: its mid is VES-per-EUR.
 * - A resolved rate must be positive; a non-positive one would later divide the
 *   base amount into a garbage or non-finite USD value.
 */
export async function resolveEntryRate(
    lookup: RateLookup,
    currency: string,
    rateType: EntryRateType,
    customRate: number | undefined,
    date: string
): Promise<number> {
    if (rateType === "custom") {
        if (customRate === undefined) {
            throw new MoneyValidationError('customRate is required when exchangeRateType is "custom"');
        }
        if (!Number.isFinite(customRate) || customRate <= 0) {
            throw new MoneyValidationError("customRate must be a positive number");
        }
        return customRate;
    }
    if (customRate !== undefined) {
        throw new MoneyValidationError('customRate is only allowed when exchangeRateType is "custom"');
    }
    if (rateType === "eur_reference" && currency !== "VES") {
        throw new MoneyValidationError("eur_reference rates are only available for VES amounts");
    }
    const row = await lookup(currency, rateType, date);
    if (!row) {
        throw new MoneyValidationError(`No ${rateType} rate available for ${currency} on ${date}`);
    }
    return requirePositiveRate(row.rate, currency, rateType, date);
}

/**
 * A rate divides, so a zero or a negative one does not merely misprice: it sends
 * the amount to infinity or flips its sign, turning an expense into income. Both
 * legs of an `eur_reference` conversion go through here — ingestion validates
 * too, but `exchangeRates` stores a bare `v.number()` and `RateLookup` is an
 * injectable interface, so this is the last guard before the divide.
 */
function requirePositiveRate(rate: number, currency: string, rateType: string, date: string): number {
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new MoneyValidationError(
            `Resolved ${rateType} rate for ${currency} on ${date} must be a positive number, got: ${rate}`
        );
    }
    return rate;
}

export interface ComputeAmountUSDInput {
    baseAmount: number;
    date: string;
    exchangeRate: number;
    exchangeRateType: EntryRateType;
}

/**
 * `numerator / Π denominators`, evaluated as one exact rational and reduced to
 * a micro-dollar (`USD_SCALE`) integer with a SINGLE half-even rounding.
 */
function divideToUsd(numerator: ScaledInt, denominators: ScaledInt[]): number {
    let denominatorScaleSum = 0n;
    let denominatorProduct = 1n;
    for (const denominator of denominators) {
        denominatorScaleSum += denominator.scale;
        denominatorProduct *= denominator.amount;
    }
    if (denominatorProduct === 0n) {
        return Number.POSITIVE_INFINITY;
    }
    const scaledNumerator = numerator.amount * DECIMAL_RADIX ** (denominatorScaleSum + USD_SCALE);
    const scaledDenominator = denominatorProduct * DECIMAL_RADIX ** numerator.scale;
    const micro = divideHalfEven(scaledNumerator, scaledDenominator);
    const money = dinero({ amount: micro, currency: USD, scale: USD_SCALE });
    return Number(toDecimal(money));
}

/**
 * Freezes an UNROUNDED (micro-dollar precision) USD amount.
 *
 * `eur_reference` (VES-only) is two-legged: the stored `exchangeRate` is the
 * VES-per-EUR mid, so the amount is `baseAmount / exchangeRate / eurRate` with
 * the EUR leg resolved as the EUR `official` rate on `date`.
 *
 * A finite `(baseAmount, exchangeRate)` pair can still overflow the division to
 * a non-representable amount, which is rejected here rather than stored.
 */
export async function computeAmountUSD(lookup: RateLookup, input: ComputeAmountUSDInput): Promise<number> {
    const numerator = toScaledInt(input.baseAmount);
    // The entry's own rate, guarded like the EUR leg below it. Without this the
    // doc above is a promise only the second leg keeps: `exchangeRate: -40`
    // divides to a finite negative, passes the overflow check, and stores an
    // expense as income.
    const denominators: ScaledInt[] = [
        toScaledInt(requirePositiveRate(input.exchangeRate, "the entry", input.exchangeRateType, input.date)),
    ];
    if (input.exchangeRateType === "eur_reference") {
        const eurRow = await lookup("EUR", "official", input.date);
        if (!eurRow) {
            throw new MoneyValidationError(
                `No EUR official rate available on ${input.date} for eur_reference conversion`
            );
        }
        denominators.push(toScaledInt(requirePositiveRate(eurRow.rate, "EUR", "official", input.date)));
    }
    const amountUSD = divideToUsd(numerator, denominators);
    if (!Number.isFinite(amountUSD)) {
        throw new MoneyValidationError(
            `Computed USD amount is not finite (baseAmount ${input.baseAmount} at rate ${input.exchangeRate})`
        );
    }
    return amountUSD;
}
