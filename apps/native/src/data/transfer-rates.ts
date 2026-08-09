import type { EntryRateType } from "@outlayr/money/rates";
import { and, eq, inArray } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { exchangeRates } from "@/db/schema";
import { buildRateTable, type RateTable } from "@/domain/valuation";
import { useLiveQuery } from "./live-query";

/**
 * Both sides of a transfer at once, unlike `useValuationIn` which is scoped to a
 * single quote — a cross-currency transfer has to cross two legs, and loading
 * them separately would let one arrive a render before the other.
 *
 * Callers pass the market type to read; `custom` has no rows of its own, so the
 * screen substitutes the last market type it showed.
 */
export function useTransferRates(db: Database, codes: readonly string[], rateType: EntryRateType): RateTable {
	const quotes = useMemo(() => [...new Set(codes.filter((code) => code !== "USD"))].sort(), [codes]);
	const rows = useLiveQuery(
		exchangeRates,
		() =>
			db
				.select({ date: exchangeRates.date, quote: exchangeRates.quote, rate: exchangeRates.rate })
				.from(exchangeRates)
				.where(
					and(
						inArray(exchangeRates.quote, quotes.length > 0 ? [...quotes] : [""]),
						eq(exchangeRates.rateType, rateType)
					)
				),
		[quotes.join(","), rateType]
	);
	return useMemo(() => buildRateTable(rows), [rows]);
}
