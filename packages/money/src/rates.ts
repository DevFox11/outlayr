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

function divideToUsd(numerator: ScaledInt, denominator: ScaledInt): number {
    if (denominator.amount === 0n) {
        return Number.POSITIVE_INFINITY;
    }
    const scaledNumerator = numerator.amount * DECIMAL_RADIX ** (denominator.scale + USD_SCALE);
    const scaledDenominator = denominator.amount * DECIMAL_RADIX ** numerator.scale;
    const micro = divideHalfEven(scaledNumerator, scaledDenominator);
    const money = dinero({ amount: micro, currency: USD, scale: USD_SCALE });
    return Number(toDecimal(money));
}

/**
 * Freezes an UNROUNDED (micro-dollar precision) USD amount.
 *
 * A finite `(baseAmount, exchangeRate)` pair can still overflow the division to
 * a non-representable amount, which is rejected here rather than stored.
 */
export function computeAmountUSD(input: ComputeAmountUSDInput): number {
    const amountUSD = divideToUsd(
        toScaledInt(input.baseAmount),
        toScaledInt(requirePositiveRate(input.exchangeRate, "the entry", input.exchangeRateType, input.date))
    );
    if (!Number.isFinite(amountUSD)) {
        throw new MoneyValidationError(
            `Computed USD amount is not finite (baseAmount ${input.baseAmount} at rate ${input.exchangeRate})`
        );
    }
    return amountUSD;
}
