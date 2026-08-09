import { type CurrencyEntry, cellFigures, toCells } from "./currency-totals";
import { type LogFigures, ZERO_FIGURES } from "./log-measure";
import type { RateTable } from "./valuation";

export interface ScopeTotals {
	/** Every other currency the scope used, dominance order. */
	others: LogFigures[];
	/**
	 * The bucket the screen is being read in, or the dominant one when the scope
	 * holds nothing that can be placed there — a figure labelled with a currency
	 * its numbers are not in states something untrue.
	 */
	shown: LogFigures;
}

/**
 * In, out and net for a whole filtered scope, split per currency.
 *
 * Every entry the filter matched has to be handed in. The Log's filtered read is
 * unwindowed for exactly this reason: only the `all` list is paged, and a figure
 * totalled over whatever has been scrolled into memory answers a different
 * question than the one the filter asked.
 */
export function scopeTotals(
	entries: readonly CurrencyEntry[],
	displayCurrency: string,
	rates?: RateTable
): ScopeTotals {
	// Transfers are listed in the scope but are not part of it: money moving
	// between two accounts the user owns is neither in nor out.
	const counted = entries.filter((entry) => !("excludedFromTotals" in entry && entry.excludedFromTotals));
	const ordered = cellFigures(toCells(counted), displayCurrency, rates);
	const shown = ordered.find((figures) => figures.currencyCode === displayCurrency) ??
		ordered[0] ?? { currencyCode: displayCurrency, ...ZERO_FIGURES };

	return { others: ordered.filter((figures) => figures !== shown), shown };
}
