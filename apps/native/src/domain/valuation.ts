import { convertFromUsd, utcDateString } from "@outlayr/money";

export interface Valuable {
	amount: number;
	/**
	 * Null means the entry recorded none — it was written under whatever the
	 * ledger's currency was THAT DAY, which is not necessarily today's. Only
	 * `amountUsd` can say what it was worth; see {@link valueExactIn}.
	 */
	currency: string | null;
	/** Frozen at write; null when no rate was available then. */
	amountUsd: number | null;
	/** UTC `YYYY-MM-DD` of the day the money moved. */
	dateKey: string;
}

/** USD→currency rates; `get` answers with the newest rate on or before `dateKey`. */
export interface RateTable {
	get(code: string, dateKey: string): number | null;
}

export function buildRateTable(
	rows: readonly { quote: string; date: string; rate: number }[],
): RateTable {
	const byCode = new Map<string, { date: string; rate: number }[]>();
	for (const row of rows) {
		const list = byCode.get(row.quote);
		if (list) {
			list.push({ date: row.date, rate: row.rate });
		} else {
			byCode.set(row.quote, [{ date: row.date, rate: row.rate }]);
		}
	}
	// Descending, so the first entry at or before a date is the answer. Dates are
	// `YYYY-MM-DD`, which sorts lexically exactly as it sorts chronologically.
	for (const list of byCode.values()) {
		list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	}

	return {
		get(code, dateKey) {
			const list = byCode.get(code);
			if (!list) {
				return null;
			}
			for (const entry of list) {
				if (entry.date <= dateKey) {
					return entry.rate;
				}
			}
			return null;
		},
	};
}

/**
 * What a row is genuinely worth in the display currency, or null when the data
 * cannot say.
 *
 * A row stating the display currency returns its stored amount untouched — it
 * must never round-trip through USD, or a ledger kept entirely in one currency
 * would drift by a cent. Anything else converts from the frozen `amountUsd` at
 * the rate of the day it happened, NOT today's, so a total for last month means
 * the same thing tomorrow as it does now.
 *
 * A null `currency` takes the conversion path, not the untouched one: null means
 * the row named no currency, and the ledger's currency is a setting the user can
 * change.
 */
export function valueExactIn(
	row: Valuable,
	displayCurrency: string,
	rates: RateTable,
): number | null {
	if (row.currency === displayCurrency) {
		return row.amount;
	}
	// A row already stated in USD needs nothing frozen: its USD value is the amount.
	const amountUsd = row.currency === "USD" ? row.amount : row.amountUsd;
	if (amountUsd === null) {
		return null;
	}
	if (displayCurrency === "USD") {
		return amountUsd;
	}
	const rate = rates.get(displayCurrency, row.dateKey);
	if (rate === null) {
		return null;
	}
	return convertFromUsd(amountUsd, rate, displayCurrency);
}

/** {@link valueExactIn}, standing in the face value when it declines. */
export function valueIn(
	row: Valuable,
	displayCurrency: string,
	rates: RateTable,
): number {
	return valueExactIn(row, displayCurrency, rates) ?? row.amount;
}

export interface DatedValuable {
	amount: number;
	currency: string | null;
	amountUsd: number | null;
	date: Date;
}

export function sumValuedIn(
	rows: readonly DatedValuable[],
	displayCurrency: string,
	rates: RateTable,
): number {
	let total = 0;
	for (const row of rows) {
		total += valueIn(
			{
				amount: row.amount,
				currency: row.currency,
				amountUsd: row.amountUsd,
				dateKey: utcDateString(row.date.getTime()),
			},
			displayCurrency,
			rates,
		);
	}
	return total;
}

interface BudgetLimit {
	amount: number;
	currency: string | null;
	amountUsd: number | null;
}

/**
 * A budget's target restated in the display currency at the rate of the day its
 * window opened — *both* legs of the conversion, so the figure is one day's
 * cross rate rather than a nominal amount frozen on one date and converted on
 * another.
 *
 * The window's day rather than today keeps the target still while the window is
 * being spent, and rather than the day the target was set because the target is
 * shown beside, and subtracted from, spending valued at its own recent days. A
 * limit in three-year-old money makes that subtraction meaningless.
 */
export function limitIn(
	row: BudgetLimit,
	windowStart: Date,
	displayCurrency: string,
	rates: RateTable,
): number {
	const dateKey = utcDateString(windowStart.getTime());
	return valueIn(
		{
			amount: row.amount,
			currency: row.currency,
			amountUsd: limitUsdOn(row, dateKey, rates),
			dateKey,
		},
		displayCurrency,
		rates,
	);
}

/** The stored freeze is the fallback: a stale date still beats face value. */
function limitUsdOn(
	row: BudgetLimit,
	dateKey: string,
	rates: RateTable,
): number | null {
	if (row.currency === null || row.currency === "USD") {
		return row.amountUsd;
	}
	const rate = rates.get(row.currency, dateKey);
	// A stored rate is currency-per-USD, so USD is the amount divided by it.
	return rate === null || rate <= 0 ? row.amountUsd : row.amount / rate;
}

/**
 * Null when no rate reaches back to `dateKey`.
 *
 * Convert the sum once, never row by row: rounding per row is how a header total
 * and the subtotals under it end up cents apart.
 */
export function convertUsdSum(
	amountUsd: number,
	dateKey: string,
	displayCurrency: string,
	rates: RateTable,
): number | null {
	if (displayCurrency === "USD") {
		return amountUsd;
	}
	const rate = rates.get(displayCurrency, dateKey);
	return rate === null
		? null
		: convertFromUsd(amountUsd, rate, displayCurrency);
}

export function isExact(
	row: Valuable,
	displayCurrency: string,
	rates: RateTable,
): boolean {
	return valueExactIn(row, displayCurrency, rates) !== null;
}
