import { utcDateString } from "@outlayr/money";
import { convertUsdSum, type RateTable } from "./valuation";

export interface CurrencyBucket {
	/** Already signed — income adds, expense subtracts. */
	amount: number;
	currencyCode: string;
	transactionCount: number;
}

/** Mirrors Swift's `CurrencyTotals.dominanceOrder`. */
export function dominanceOrder(counts: Map<string, number>, globalCurrency: string): string[] {
	return [...counts.keys()].sort((lhs, rhs) => {
		const byCount = (counts.get(rhs) ?? 0) - (counts.get(lhs) ?? 0);
		if (byCount !== 0) {
			return byCount;
		}
		if ((lhs === globalCurrency) !== (rhs === globalCurrency)) {
			return lhs === globalCurrency ? -1 : 1;
		}
		return lhs.localeCompare(rhs);
	});
}

export interface CurrencyEntry {
	amount: number;
	/** Frozen USD value, when the entry has one. Absent leaves it unconvertible. */
	amountUsd?: number | null;
	/**
	 * Null means the entry stated none — it was written under whatever the
	 * ledger's currency was that day, which today's setting cannot be assumed to
	 * match. Only its frozen USD value can place it.
	 */
	currency?: string | null;
	/**
	 * When the money moved; absent leaves the entry unconvertible. The
	 * transaction's own instant, not its local midnight — the same instant the
	 * USD value was frozen against.
	 */
	date?: Date;
	income: boolean;
}

/**
 * One `(currency, UTC day, direction)` cell of a set of entries.
 *
 * Conversion happens per cell, never per row: the Log's header aggregates in
 * SQL and the day sections aggregate in JS, and only a shape both can produce
 * makes a period total and the day subtotals under it round to the same cents.
 */
export interface CurrencyCell {
	/** Total in `currencyCode`, unsigned, over every row in the cell. */
	amount: number;
	/** Total of the frozen USD values, unsigned. Zero if none were canonical. */
	amountUsd: number;
	count: number;
	/**
	 * The currency the rows stated, or null when they stated none. Null is NOT
	 * the global currency: only their frozen USD value can place those rows.
	 */
	currencyCode: string | null;
	/** UTC `YYYY-MM-DD`; the empty string when the rows carried no date. */
	dateKey: string;
	income: boolean;
	/** Unsigned total of just the rows with no frozen USD value. */
	unconvertedAmount: number;
	unconvertedCount: number;
}

export function toCells(entries: readonly CurrencyEntry[]): CurrencyCell[] {
	const cells = new Map<string, CurrencyCell>();
	for (const entry of entries) {
		const currencyCode = entry.currency ?? null;
		const dateKey = entry.date ? utcDateString(entry.date.getTime()) : "";
		const key = `${currencyCode}|${dateKey}|${entry.income}`;
		let cell = cells.get(key);
		if (!cell) {
			cell = {
				amount: 0,
				amountUsd: 0,
				count: 0,
				currencyCode,
				dateKey,
				income: entry.income,
				unconvertedAmount: 0,
				unconvertedCount: 0,
			};
			cells.set(key, cell);
		}
		cell.amount += entry.amount;
		cell.count += 1;
		if (entry.amountUsd == null) {
			cell.unconvertedAmount += entry.amount;
			cell.unconvertedCount += 1;
		} else {
			cell.amountUsd += entry.amountUsd;
		}
	}
	return [...cells.values()];
}

/**
 * A cell's magnitude in the global currency, falling back to its face value
 * when no rate reaches it. {@link cellFigures} keeps the split instead.
 */
export function valueCell(cell: CurrencyCell, globalCurrency: string, rates?: RateTable): number {
	if (cell.currencyCode === globalCurrency || !rates) {
		return cell.amount;
	}
	const converted = convertUsdSum(cell.amountUsd, cell.dateKey, globalCurrency, rates);
	return converted === null ? cell.amount : converted + cell.unconvertedAmount;
}

export interface CurrencyFigures {
	count: number;
	currencyCode: string;
	expense: number;
	income: number;
}

/**
 * Buckets cells by the currency they end up expressed in, dominant first.
 *
 * Without `rates` nothing is converted and each currency keeps its own bucket.
 * A cell the data cannot convert always keeps its own too. An empty set yields
 * one zero bucket in the global currency, so callers always have something to
 * render.
 */
export function cellFigures(
	cells: readonly CurrencyCell[],
	globalCurrency: string,
	rates?: RateTable
): CurrencyFigures[] {
	const income = new Map<string, number>();
	const expense = new Map<string, number>();
	const counts = new Map<string, number>();

	const add = (code: string, magnitude: number, isIncome: boolean, n: number) => {
		const side = isIncome ? income : expense;
		side.set(code, (side.get(code) ?? 0) + magnitude);
		counts.set(code, (counts.get(code) ?? 0) + n);
	};

	for (const cell of cells) {
		// Only a cell that NAMES the global currency is already in it; one that
		// named none goes through its frozen USD value like any other.
		if (cell.currencyCode === globalCurrency) {
			add(globalCurrency, cell.amount, cell.income, cell.count);
			continue;
		}
		const converted =
			rates && cell.unconvertedCount < cell.count
				? convertUsdSum(cell.amountUsd, cell.dateKey, globalCurrency, rates)
				: null;
		if (converted === null) {
			// Nothing can place it; the global currency is the only label left.
			add(cell.currencyCode ?? globalCurrency, cell.amount, cell.income, cell.count);
			continue;
		}
		add(globalCurrency, converted, cell.income, cell.count - cell.unconvertedCount);
		if (cell.unconvertedCount > 0) {
			// Rows with no frozen USD value stay in their own currency: the rate
			// exists, but there is nothing to apply it to.
			add(cell.currencyCode ?? globalCurrency, cell.unconvertedAmount, cell.income, cell.unconvertedCount);
		}
	}

	if (counts.size === 0) {
		return [{ count: 0, currencyCode: globalCurrency, expense: 0, income: 0 }];
	}

	return dominanceOrder(counts, globalCurrency).map((code) => ({
		count: counts.get(code) ?? 0,
		currencyCode: code,
		expense: expense.get(code) ?? 0,
		income: income.get(code) ?? 0,
	}));
}

/** {@link cellFigures} collapsed to one signed net per currency. */
export function cellTotals(
	cells: readonly CurrencyCell[],
	globalCurrency: string,
	rates?: RateTable
): CurrencyBucket[] {
	return cellFigures(cells, globalCurrency, rates).map((figures) => ({
		amount: figures.income - figures.expense,
		currencyCode: figures.currencyCode,
		transactionCount: figures.count,
	}));
}

export function currencyTotals(
	entries: readonly CurrencyEntry[],
	globalCurrency: string,
	rates?: RateTable
): CurrencyBucket[] {
	return cellTotals(toCells(entries), globalCurrency, rates);
}
