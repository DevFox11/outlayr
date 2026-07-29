import { utcDateString } from "@outlayr/money";
import type { TranslateFn } from "@/i18n/context";
import { type DatedValuable, type RateTable, valueExactIn } from "./valuation";

/** How much of the ledger the converted figures on screen actually rest on. */
export interface ValuationCoverage {
	/** Rows carrying a frozen USD value. */
	converted: number;
	/** Rows a later rate pull can still value. */
	pending: number;
	/**
	 * Rows dated before the earliest rate their currency has. The server serves a
	 * bounded window and every pull wipe-replaces the local table, so no later
	 * pull reaches back to them — face value is final, not provisional.
	 */
	beyondRateHistory: number;
}

/** A USD leg needs no rate consulted, so it can never fall off the history. */
function predatesHistory(
	code: string | null,
	dateKey: string,
	rates: RateTable,
): boolean {
	if (code === null || code === "USD") {
		return false;
	}
	const floor = rates.earliest(code);
	return floor !== null && dateKey < floor;
}

/**
 * {@link ValuationCoverage} for one set of rows rather than the whole ledger —
 * what a screen showing a bounded window, such as a closed budget period, can
 * honestly say about the figures it is adding up.
 *
 * Both legs of the conversion are checked: a row already carrying a USD value
 * is still unreachable if the display currency has no rate back on its day.
 */
export function coverageOf(
	rows: readonly DatedValuable[],
	displayCurrency: string,
	rates: RateTable,
): ValuationCoverage {
	const coverage: ValuationCoverage = {
		converted: 0,
		pending: 0,
		beyondRateHistory: 0,
	};
	for (const row of rows) {
		const dateKey = utcDateString(row.date.getTime());
		const valuable = {
			amount: row.amount,
			currency: row.currency,
			amountUsd: row.amountUsd,
			dateKey,
		};
		if (valueExactIn(valuable, displayCurrency, rates) !== null) {
			coverage.converted += 1;
		} else if (
			predatesHistory(row.currency, dateKey, rates) ||
			predatesHistory(displayCurrency, dateKey, rates)
		) {
			coverage.beyondRateHistory += 1;
		} else {
			coverage.pending += 1;
		}
	}
	return coverage;
}

/** Null when every figure on screen is a converted one. */
export function coverageNote(
	coverage: ValuationCoverage,
	t: TranslateFn,
): string | null {
	const { converted, pending, beyondRateHistory } = coverage;
	const total = converted + pending + beyondRateHistory;
	if (total === 0 || (pending === 0 && beyondRateHistory === 0)) {
		return null;
	}
	if (pending === 0) {
		return t("coverage.predateOnly", { count: beyondRateHistory, total });
	}
	if (beyondRateHistory === 0) {
		return t("coverage.pending", { count: pending, total });
	}
	return t("coverage.pendingAndPredate", {
		count: pending,
		total,
		predate: beyondRateHistory,
	});
}
