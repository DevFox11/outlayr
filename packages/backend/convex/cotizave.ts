import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { utcDateString } from "./lib/currencies";
import type { MarketRateType } from "./lib/currencies";

const COTIZAVE_URL = "https://api.cotizave.com/v1/fx/rates";

const VES_QUOTE = "VES";

/**
 * Cotizave market name → unified `exchangeRateType`. `reference` is the BCV
 * official rate. Note: the `eur_reference` mid is denominated VES-per-EUR (the
 * BCV official EUR rate), NOT USD→VES — it is stored verbatim per spec; any
 * USD conversion for eur_reference entries must account for that denomination.
 */
const MARKET_RATE_TYPES: Record<string, MarketRateType | undefined> = {
    binance: "binance",
    eur_reference: "eur_reference",
    reference: "official",
};

interface CotizaveMarket {
    market: string;
    mid: number;
}

function isValidMarket(value: unknown): value is CotizaveMarket {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (!("market" in value && "mid" in value)) {
        return false;
    }
    const { market, mid } = value;
    return typeof market === "string" && typeof mid === "number" && Number.isFinite(mid) && mid > 0;
}

/**
 * A payload quoting another currency pair (however well-formed) must never be
 * stored as VES rows.
 */
function hasExpectedContract(payload: unknown): boolean {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }
    if (!("base" in payload && "currency" in payload)) {
        return false;
    }
    const { base, currency } = payload;
    return base === "USD" && currency === VES_QUOTE;
}

function extractRates(payload: unknown) {
    if (typeof payload !== "object" || payload === null || !("rates" in payload)) {
        return null;
    }
    const { rates } = payload;
    if (!Array.isArray(rates)) {
        return null;
    }
    const parsed: { quote: string; rateType: MarketRateType; rate: number }[] = [];
    for (const record of rates) {
        if (!isValidMarket(record)) {
            continue;
        }
        const rateType = MARKET_RATE_TYPES[record.market];
        if (rateType === undefined) {
            continue;
        }
        parsed.push({ quote: VES_QUOTE, rate: record.mid, rateType });
    }
    return parsed;
}

export const fetchRates = internalAction({
    args: {},
    handler: async (ctx) => {
        const apiKey = process.env.COTIZAVE_API_KEY;
        if (!apiKey) {
            throw new Error("COTIZAVE_API_KEY is not set; cannot fetch cotizave VES rates");
        }

        let payload: unknown;
        try {
            const response = await fetch(COTIZAVE_URL, {
                headers: { "X-API-Key": apiKey },
            });
            if (!response.ok) {
                console.error(`Cotizave fetch failed with HTTP ${response.status}`);
                return null;
            }
            payload = await response.json();
        } catch (error) {
            console.error("Cotizave fetch request failed", error);
            return null;
        }

        if (!hasExpectedContract(payload)) {
            console.error("Cotizave response did not match the expected USD-based VES contract");
            return null;
        }

        const rates = extractRates(payload);
        if (rates === null) {
            console.error("Cotizave response was not a parseable rates array");
            return null;
        }
        if (rates.length === 0) {
            console.error("Cotizave response contained no valid target markets");
            return null;
        }

        const fetchedAt = Date.now();
        await ctx.runMutation(internal.exchangeRates.upsertRates, {
            date: utcDateString(fetchedAt),
            fetchedAt,
            rates,
            source: "cotizave",
        });
        return null;
    },
    returns: v.null(),
});
