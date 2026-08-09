import { convertFromUsd, roundMoney, utcDateString } from "@outlayr/money";

export interface Valuable {
	amount: number;
	/** Frozen at write; null when no rate was available then. */
	amountUsd: number | null;
	/**
	 * Null means the entry recorded none — it was written under whatever the
	 * ledger's currency was THAT DAY, which is not necessarily today's. Only
	 * `amountUsd` can say what it was worth; see {@link valueExactIn}.
	 */
	currency: string | null;
	/** UTC `YYYY-MM-DD` of the day the money moved. */
	dateKey: string;
}

/** USD→currency rates; `get` answers with the newest rate on or before `dateKey`. */
export interface RateTable {
	/**
	 * The oldest day the table holds for `code`, or null when it holds none.
	 *
	 * Every pull wipe-replaces the table with a bounded window, so a day before
	 * this floor is not waiting on anything — it is the line between "not valued
	 * yet" and "never will be". A code with no floor at all is the former.
	 */
	earliest: (code: string) => string | null;
	get: (code: string, dateKey: string) => number | null;
}

export function buildRateTable(rows: readonly { quote: string; date: string; rate: number }[]): RateTable {
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
		earliest(code) {
			const list = byCode.get(code);
			return list?.at(-1)?.date ?? null;
		},
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
export function valueExactIn(row: Valuable, displayCurrency: string, rates: RateTable): number | null {
	if (row.currency === displayCurrency) {
		return row.amount;
	}
	const amountUsd = canonicalOf(row);
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

/** A row already stated in USD needs nothing frozen: its USD value is the amount. */
function canonicalOf(row: Valuable): number | null {
	return row.currency === "USD" ? row.amount : row.amountUsd;
}

/** {@link valueExactIn}, standing in the face value when it declines. */
export function valueIn(row: Valuable, displayCurrency: string, rates: RateTable): number {
	return valueExactIn(row, displayCurrency, rates) ?? row.amount;
}

/** {@link Valuable} with the direction that splits the Log's cells. */
export interface DirectedValuable extends Valuable {
	income?: boolean;
}

/**
 * Values a set of rows the way the Log aggregates in SQL: rows sharing a
 * currency, a UTC day and a direction convert as one sum, so any figure built
 * over whole cells is the figure the Log header prints for the same rows.
 *
 * Whoever converts row by row rounds once per row, and the drift against the
 * header is unbounded in the row count. Each row still gets a value of its own —
 * the cell's total, handed out as running differences — so callers that group,
 * bucket or filter afterwards keep working on rows.
 *
 * Values come back positionally.
 */
export function valueRowsIn(rows: readonly DirectedValuable[], displayCurrency: string, rates: RateTable): number[] {
	const values: number[] = new Array(rows.length);
	const cells = new Map<string, number[]>();

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		// USD needs no conversion pass, so its rows never round and per-row is
		// already per-cell; the other two cannot be converted at all.
		if (displayCurrency === "USD" || row.currency === displayCurrency || canonicalOf(row) === null) {
			values[index] = valueIn(row, displayCurrency, rates);
			continue;
		}
		const key = `${row.currency}|${row.dateKey}|${row.income ?? false}`;
		const cell = cells.get(key);
		if (cell) {
			cell.push(index);
		} else {
			cells.set(key, [index]);
		}
	}

	for (const indices of cells.values()) {
		let runningUsd = 0;
		let assigned = 0;
		for (const index of indices) {
			const row = rows[index];
			runningUsd += canonicalOf(row) as number;
			const converted = convertUsdSum(runningUsd, row.dateKey, displayCurrency, rates);
			if (converted === null) {
				// One dateKey per cell, so no rate for it means no rate for any of them.
				for (const other of indices) {
					values[other] = rows[other].amount;
				}
				break;
			}
			values[index] = roundMoney(converted - assigned);
			assigned = converted;
		}
	}

	return values;
}

export interface DatedValuable {
	amount: number;
	amountUsd: number | null;
	currency: string | null;
	date: Date;
	income?: boolean;
}

/** {@link valueRowsIn} for rows carrying an instant rather than a UTC day key. */
export function valueDatedRowsIn(rows: readonly DatedValuable[], displayCurrency: string, rates: RateTable): number[] {
	return valueRowsIn(
		rows.map((row) => ({
			amount: row.amount,
			amountUsd: row.amountUsd,
			currency: row.currency,
			dateKey: utcDateString(row.date.getTime()),
			income: row.income,
		})),
		displayCurrency,
		rates
	);
}

export function sumValuedIn(rows: readonly DatedValuable[], displayCurrency: string, rates: RateTable): number {
	let total = 0;
	for (const value of valueDatedRowsIn(rows, displayCurrency, rates)) {
		total += value;
	}
	return total;
}

interface BudgetLimit {
	amount: number;
	amountUsd: number | null;
	currency: string | null;
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
export function limitIn(row: BudgetLimit, windowStart: Date, displayCurrency: string, rates: RateTable): number {
	const dateKey = utcDateString(windowStart.getTime());
	return valueIn(
		{
			amount: row.amount,
			amountUsd: limitUsdOn(row, dateKey, rates),
			currency: row.currency,
			dateKey,
		},
		displayCurrency,
		rates
	);
}

/** The stored freeze is the fallback: a stale date still beats face value. */
function limitUsdOn(row: BudgetLimit, dateKey: string, rates: RateTable): number | null {
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
	rates: RateTable
): number | null {
	if (displayCurrency === "USD") {
		return amountUsd;
	}
	const rate = rates.get(displayCurrency, dateKey);
	return rate === null ? null : convertFromUsd(amountUsd, rate, displayCurrency);
}

export function isExact(row: Valuable, displayCurrency: string, rates: RateTable): boolean {
	return valueExactIn(row, displayCurrency, rates) !== null;
}
