import type { MarketRateType as MoneyMarketRateType } from "@outlayr/money/rates";
import { v } from "convex/values";
import type { Infer } from "convex/values";

export { PICKABLE_CURRENCY_CODES } from "@outlayr/money/catalog";
export { utcDateString } from "@outlayr/money/dates";

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

export const rateSource = v.union(v.literal("frankfurter"), v.literal("cotizave"), v.literal("openexchangerates"));

export type RateSource = Infer<typeof rateSource>;
