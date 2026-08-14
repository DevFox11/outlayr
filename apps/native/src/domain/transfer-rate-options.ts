import { utcDateString } from "@outlayr/money/dates";
import { ENTRY_RATE_TYPES } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";

import type { RateTable } from "./valuation";

/** The only currency `resolveEntryRate` accepts `eur_reference` for. */
const EUR_REFERENCE_CURRENCY = "VES";

/**
 * Offered rate sources for a currency, `official` first so the default costs no
 * lookup. `binance` is absent by construction: it lives in `MARKET_RATE_TYPES`
 * as VES-per-USDT market data, and USDT is not USD.
 */
export function rateTypeOptions(currency: string): EntryRateType[] {
    return ENTRY_RATE_TYPES.filter((type) => type !== "eur_reference" || currency === EUR_REFERENCE_CURRENCY);
}

function perUsd(currency: string, dateKey: string, rates: RateTable): number | null {
    if (currency === "USD") {
        return 1;
    }
    const rate = rates.get(currency, dateKey);
    return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function marketRateFor(from: string, to: string, date: Date, rates: RateTable): number | null {
    if (from === to) {
        return 1;
    }
    const dateKey = utcDateString(date.getTime());
    const fromRate = perUsd(from, dateKey, rates);
    const toRate = perUsd(to, dateKey, rates);
    if (fromRate === null || toRate === null) {
        return null;
    }
    const rate = toRate / fromRate;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}
