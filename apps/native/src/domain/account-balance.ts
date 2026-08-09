import { type CurrencyCell, valueCell } from "./currency-totals";
import { convertUsdSum, type RateTable } from "./valuation";

export interface AccountBalanceInput {
	currency: string;
	initialBalance: number;
}

export interface AccountCompositionEntry {
	/** Signed net at face value — income adds, expense subtracts. */
	amount: number;
	currencyCode: string | null;
}

export interface AccountBalance {
	composition: AccountCompositionEntry[];
	/** False when any cell fell back to face value instead of converting. */
	exact: boolean;
	/** `initialBalance` plus every cell, valued in the account's currency. */
	total: number;
}

function cellIsExact(cell: CurrencyCell, currency: string, rates: RateTable) {
	if (cell.currencyCode === currency) {
		return true;
	}
	if (cell.unconvertedCount > 0) {
		return false;
	}
	return convertUsdSum(cell.amountUsd, cell.dateKey, currency, rates) !== null;
}

export function accountBalance(
	account: AccountBalanceInput,
	cells: readonly CurrencyCell[],
	rates: RateTable
): AccountBalance {
	let total = account.initialBalance;
	let exact = true;
	const composition = new Map<string | null, number>();

	for (const cell of cells) {
		const sign = cell.income ? 1 : -1;
		total += sign * valueCell(cell, account.currency, rates);
		if (!cellIsExact(cell, account.currency, rates)) {
			exact = false;
		}
		composition.set(cell.currencyCode, (composition.get(cell.currencyCode) ?? 0) + sign * cell.amount);
	}

	return {
		composition: [...composition.entries()].map(([currencyCode, amount]) => ({
			amount,
			currencyCode,
		})),
		exact,
		total,
	};
}
