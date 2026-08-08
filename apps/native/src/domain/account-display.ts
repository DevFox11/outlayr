import { utcDateString } from "@outlayr/money";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import {
	type AccountCompositionEntry,
	accountBalance,
} from "./account-balance";
import type { CurrencyCell } from "./currency-totals";
import { formatAmount } from "./money";
import { convertUsdSum, type RateTable } from "./valuation";

/** A balance's display string: "-" only when negative, never a "+". */
export function formatSignedAmount(
	amount: number,
	code: string,
	showCents = true,
	language: Language = runtimeLanguage(),
): string {
	const magnitude = formatAmount(Math.abs(amount), code, showCents, language);
	return amount < 0 ? `-${magnitude}` : magnitude;
}

export function isMultiCurrency(
	composition: readonly AccountCompositionEntry[],
	accountCurrency: string,
): boolean {
	return composition.some(
		(entry) =>
			entry.currencyCode !== null && entry.currencyCode !== accountCurrency,
	);
}

export interface OverviewAccount {
	id: string;
	currency: string;
	initialBalance: number;
	initialBalanceUsd: number | null;
	initialBalanceDate: Date;
}

export interface AccountsOverview {
	count: number;
	total: number;
	/** False when any part fell back to face value instead of converting. */
	exact: boolean;
}

export type AccountCellRow = CurrencyCell & { accountId: string | null };

/**
 * Every account's balance valued into the display currency and summed. Null
 * with no accounts, so the card can disappear rather than print a zero.
 */
export function accountsOverview(
	accounts: readonly OverviewAccount[],
	cells: readonly AccountCellRow[],
	displayCurrency: string,
	rates: RateTable,
): AccountsOverview | null {
	if (accounts.length === 0) {
		return null;
	}
	const byAccount = new Map<string, CurrencyCell[]>();
	for (const cell of cells) {
		if (cell.accountId == null) {
			continue;
		}
		const bucket = byAccount.get(cell.accountId);
		if (bucket) {
			bucket.push(cell);
		} else {
			byAccount.set(cell.accountId, [cell]);
		}
	}

	let total = 0;
	let exact = true;
	for (const account of accounts) {
		const start = initialInDisplay(account, displayCurrency, rates);
		const flow = accountBalance(
			{ currency: displayCurrency, initialBalance: 0 },
			byAccount.get(account.id) ?? [],
			rates,
		);
		total += start.value + flow.total;
		exact = exact && start.exact && flow.exact;
	}
	return { count: accounts.length, total, exact };
}

function initialInDisplay(
	account: OverviewAccount,
	displayCurrency: string,
	rates: RateTable,
): { value: number; exact: boolean } {
	if (account.currency === displayCurrency || account.initialBalance === 0) {
		return { value: account.initialBalance, exact: true };
	}
	if (account.initialBalanceUsd == null) {
		return { value: account.initialBalance, exact: false };
	}
	const converted = convertUsdSum(
		account.initialBalanceUsd,
		utcDateString(account.initialBalanceDate.getTime()),
		displayCurrency,
		rates,
	);
	return converted == null
		? { value: account.initialBalance, exact: false }
		: { value: converted, exact: true };
}
