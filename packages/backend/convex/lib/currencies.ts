import {
    assertFiniteNumber as moneyAssertFiniteNumber,
    assertOptionalFiniteNumber as moneyAssertOptionalFiniteNumber,
    assertOptionalValidEpochMs as moneyAssertOptionalValidEpochMs,
    assertValidEpochMs as moneyAssertValidEpochMs,
} from "@outlayr/money/assert";
import { MoneyValidationError } from "@outlayr/money/errors";
import {
    computeAmountUSD as moneyComputeAmountUSD,
    resolveEntryRate as moneyResolveEntryRate,
} from "@outlayr/money/rates";
import type {
    ComputeAmountUSDInput,
    EntryRateType as MoneyEntryRateType,
    MarketRateType as MoneyMarketRateType,
    RateLookup,
} from "@outlayr/money/rates";
import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

export { PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";
export { isPickableCurrency } from "@outlayr/money/currency";
export { utcDateString } from "@outlayr/money/dates";
export { convertFromUsd, roundMoney } from "@outlayr/money/round";
export { METAL_CURRENCY_CODES } from "@outlayr/money/currency";

/**
 * Convex boundary shim over `@outlayr/money`: rethrows `MoneyValidationError`
 * as `ConvexError`.
 */

export type EntryRateType = MoneyEntryRateType;
export type MarketRateType = MoneyMarketRateType;

/**
 * `binance` (VES-per-USDT) is ingested from cotizave as INFORMATIONAL market
 * data — it may prefill a custom-rate suggestion in the UI, but it never
 * canonicalizes a record.
 *
 * Defined explicitly (not spread from the shared array) so Convex infers the
 * precise literal union for mutation args.
 */
export const marketRateType = v.union(v.literal("official"), v.literal("eur_reference"), v.literal("binance"));

/**
 * Deliberately diverges from `marketRateType` (Decision 10): `binance` is NOT an
 * entry type because USDT ≠ USD cannot canonicalize single-leg. Binance/P2P
 * users pick `custom` with their actual operation rate (VES-per-USD).
 */
export const entryRateType = v.union(v.literal("official"), v.literal("eur_reference"), v.literal("custom"));

export const rateSource = v.union(v.literal("frankfurter"), v.literal("cotizave"));

export type RateSource = Infer<typeof rateSource>;

function toConvexError<T>(run: () => T): T {
    try {
        return run();
    } catch (error) {
        if (error instanceof MoneyValidationError) {
            throw new ConvexError(error.message);
        }
        throw error;
    }
}

async function toConvexErrorAsync<T>(run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        if (error instanceof MoneyValidationError) {
            throw new ConvexError(error.message);
        }
        throw error;
    }
}

export function assertFiniteNumber(value: number, label: string): void {
    toConvexError(() => moneyAssertFiniteNumber(value, label));
}

export function assertOptionalFiniteNumber(value: number | undefined, label: string): void {
    toConvexError(() => moneyAssertOptionalFiniteNumber(value, label));
}

export function assertValidEpochMs(value: number, label: string): void {
    toConvexError(() => moneyAssertValidEpochMs(value, label));
}

export function assertOptionalValidEpochMs(value: number | undefined, label: string): void {
    toConvexError(() => moneyAssertOptionalValidEpochMs(value, label));
}

/**
 * Newest stored row whose `date` is on or before the requested date, which is
 * what covers Frankfurter weekend and holiday gaps.
 */
export async function resolveRateOnDate(
    db: DatabaseReader,
    quote: string,
    rateType: MarketRateType,
    date: string
): Promise<Doc<"exchangeRates"> | null> {
    const rows = await db
        .query("exchangeRates")
        .withIndex("by_quote_and_rateType_and_date", (q) =>
            q.eq("quote", quote).eq("rateType", rateType).lte("date", date)
        )
        .order("desc")
        .take(1);
    return rows[0] ?? null;
}

function dbRateLookup(db: DatabaseReader): RateLookup {
    return async (quote, rateType, date) => {
        const row = await resolveRateOnDate(db, quote, rateType, date);
        return row ? { date: row.date, rate: row.rate } : null;
    };
}

export function resolveEntryRate(
    db: DatabaseReader,
    currency: string,
    rateType: EntryRateType,
    customRate: number | undefined,
    date: string
): Promise<number> {
    return toConvexErrorAsync(() => moneyResolveEntryRate(dbRateLookup(db), currency, rateType, customRate, date));
}

/** THE single canonical-USD entry point for Convex callers. */
export function computeAmountUSD(db: DatabaseReader, input: ComputeAmountUSDInput): Promise<number> {
    return toConvexErrorAsync(() => moneyComputeAmountUSD(dbRateLookup(db), input));
}
