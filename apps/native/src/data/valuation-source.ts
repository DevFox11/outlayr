import { and, eq } from "drizzle-orm";
import { getMeta, META_KEYS } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { exchangeRates } from "@/db/schema";
import { DEFAULT_CURRENCY } from "@/domain/money";
import { buildRateTable, type RateTable } from "@/domain/valuation";

export interface Valuation {
	displayCurrency: string;
	rates: RateTable;
}

/**
 * The market rate a plain entry was frozen at, and so the one its conversion
 * back out must use.
 */
const RATE_TYPE = "official";

/** A valuation with no rates — every row falls back to face value. */
export const NO_VALUATION: Valuation = {
	displayCurrency: DEFAULT_CURRENCY,
	rates: buildRateTable([]),
};

/**
 * Scoped to one quote deliberately: converting a canonical USD figure into a
 * currency needs that currency's rates and nothing else, and the whole replica
 * is thousands of rows across every pair the provider carries.
 */
export async function loadValuationIn(db: SpendDb, code: string): Promise<Valuation> {
	// USD needs no table: a canonical value is already in it.
	if (code === "USD") {
		return { displayCurrency: code, rates: buildRateTable([]) };
	}

	const rows = await db
		.select({
			date: exchangeRates.date,
			quote: exchangeRates.quote,
			rate: exchangeRates.rate,
		})
		.from(exchangeRates)
		.where(
			and(
				eq(exchangeRates.quote, code),
				// Pinned to the type entries are frozen at. VES alone carries
				// official, eur_reference and binance, and mixing them would convert
				// a figure out at a rate it was never valued in.
				eq(exchangeRates.rateType, RATE_TYPE)
			)
		);

	return { displayCurrency: code, rates: buildRateTable(rows) };
}

/** {@link loadValuationIn} for the ledger's own display currency. */
export async function loadValuation(db: SpendDb): Promise<Valuation> {
	return await loadValuationIn(db, (await getMeta(db, META_KEYS.currency)) ?? DEFAULT_CURRENCY);
}

export { RATE_TYPE as VALUATION_RATE_TYPE };
