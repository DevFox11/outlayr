import { v } from "convex/values";
import { z } from "zod";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { utcDateString } from "./lib/currencies";
import type { MarketRateType } from "./lib/currencies";

const COTIZAVE_URL = "https://api.cotizave.com/v1/fx/rates";
const RATES_TIMEOUT_MS = 20_000;

const VES_QUOTE = "VES";

/**
 * Cotizave market name → unified `exchangeRateType`. `reference` is the BCV
 * official rate.
 */
// A Map rather than an object: the key is a market name off the remote feed, so
// the lookup is of an untrusted string and `.get` answers `undefined` for one we
// do not carry without widening the table's own key type to `string`.
const MARKET_RATE_TYPES = new Map<string, MarketRateType>([
    ["binance", "binance"],
    ["eur_reference", "eur_reference"],
    ["reference", "official"],
]);

const cotizaveMarket = z.object({
    market: z.string(),
    mid: z.number().finite().positive(),
});

/**
 * The envelope, pinned to the pair we store.
 *
 * `base`/`currency` are literals rather than free strings: a payload quoting
 * another pair, however well-formed, must never be stored as VES rows. A market
 * entry that does not parse is dropped instead of failing the response, so one
 * bad row does not cost the rest of the feed — hence the per-element catch.
 */
const cotizaveResponse = z.object({
    base: z.literal("USD"),
    currency: z.literal(VES_QUOTE),
    rates: z.array(cotizaveMarket.nullable().catch(null)),
});

interface CotizaveRate {
    quote: string;
    rate: number;
    rateType: MarketRateType;
}

function extractRates(payload: z.infer<typeof cotizaveResponse>): CotizaveRate[] {
    const parsed: CotizaveRate[] = [];
    for (const record of payload.rates) {
        const rateType = record === null ? undefined : MARKET_RATE_TYPES.get(record.market);
        if (record === null || rateType === undefined) {
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
                signal: AbortSignal.timeout(RATES_TIMEOUT_MS),
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

        const contract = cotizaveResponse.safeParse(payload);
        if (!contract.success) {
            console.error("Cotizave response did not match the expected USD-based VES contract");
            return null;
        }

        const rates = extractRates(contract.data);
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
