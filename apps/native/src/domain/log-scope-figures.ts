import { cellFigures, toCells } from "@outlayr/money/currency-totals";
import type { CurrencyEntry } from "@outlayr/money/currency-totals";
import type { RateTable } from "@outlayr/money/valuation";

import { ZERO_FIGURES } from "./log-measure";
import type { LogFigures } from "./log-measure";

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

function totalled(entries: readonly CurrencyEntry[]): CurrencyEntry[] {
    return entries.filter((entry) => !("excludedFromTotals" in entry && entry.excludedFromTotals));
}

/** False when the scope holds nothing in and out could describe — every row a transfer, or no rows at all. */
export function scopeHasFigures(entries: readonly CurrencyEntry[]): boolean {
    return totalled(entries).length > 0;
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
    const ordered = cellFigures(toCells(totalled(entries)), displayCurrency, rates);
    const shown = ordered.find((figures) => figures.currencyCode === displayCurrency) ??
        ordered[0] ?? { currencyCode: displayCurrency, ...ZERO_FIGURES };

    return { others: ordered.filter((figures) => figures !== shown), shown };
}
