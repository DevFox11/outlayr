import { utcDateString } from "@outlayr/money/dates";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { type AccountCompositionEntry, accountBalance } from "./account-balance";
import { type Balanced, netWorth, toAccountKind } from "./account-kind";
import type { CurrencyCell } from "./currency-totals";
import { formatAmount } from "./money";
import { convertUsdSum, type RateTable } from "./valuation";

/** A balance's display string: "-" only when negative, never a "+". */
export function formatSignedAmount(
	amount: number,
	code: string,
	showCents = true,
	language: Language = runtimeLanguage()
): string {
	const magnitude = formatAmount(Math.abs(amount), code, showCents, language);
	return amount < 0 ? `-${magnitude}` : magnitude;
}

export function isMultiCurrency(composition: readonly AccountCompositionEntry[], accountCurrency: string): boolean {
	return composition.some((entry) => entry.currencyCode !== null && entry.currencyCode !== accountCurrency);
}

export interface OverviewAccount {
	currency: string;
	id: string;
	initialBalance: number;
	initialBalanceDate: Date;
	initialBalanceUsd: number | null;
	/** Absent on a row written before the column existed; reads as `asset`. */
	kind?: string | null;
}

export interface AccountsOverview {
	count: number;
	/** False when any part fell back to face value instead of converting. */
	exact: boolean;
	/** What the liability accounts owe, stated positive. */
	owe: number;
	/** What the asset accounts hold. */
	own: number;
	/**
	 * Every account together, which is `own - owe`. Unchanged by the kind split:
	 * this is the same figure the card has always printed.
	 */
	total: number;
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
	rates: RateTable
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

	let exact = true;
	const balances: Balanced[] = [];
	for (const account of accounts) {
		const start = initialInDisplay(account, displayCurrency, rates);
		const flow = accountBalance(
			{ currency: displayCurrency, initialBalance: 0 },
			byAccount.get(account.id) ?? [],
			rates
		);
		balances.push({ balance: start.value + flow.total, kind: toAccountKind(account.kind) });
		exact = exact && start.exact && flow.exact;
	}
	const worth = netWorth(balances);
	return { count: accounts.length, exact, owe: worth.owe, own: worth.own, total: worth.net };
}

function initialInDisplay(
	account: OverviewAccount,
	displayCurrency: string,
	rates: RateTable
): { value: number; exact: boolean } {
	if (account.currency === displayCurrency || account.initialBalance === 0) {
		return { exact: true, value: account.initialBalance };
	}
	if (account.initialBalanceUsd == null) {
		return { exact: false, value: account.initialBalance };
	}
	const converted = convertUsdSum(
		account.initialBalanceUsd,
		utcDateString(account.initialBalanceDate.getTime()),
		displayCurrency,
		rates
	);
	return converted == null ? { exact: false, value: account.initialBalance } : { exact: true, value: converted };
}
