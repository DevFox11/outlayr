import { accountBalance } from "./account-balance";
import type { AccountCompositionEntry } from "./account-balance";
import { netWorth, toAccountKind } from "./account-kind";
import type { AccountKind, Balanced } from "./account-kind";
import type { CurrencyCell } from "./currency-totals";
import { utcDateString } from "./dates";
import { convertUsdSum } from "./valuation";
import type { RateTable } from "./valuation";

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

/** One account's standing in the display currency, in the ledger's own order. */
export interface OverviewRow {
    balance: number;
    /** False when the opening figure or any cell fell back to face value. */
    exact: boolean;
    id: string;
    kind: AccountKind;
    /** Holds money in a currency other than its own, so its own code is not the whole story. */
    multiCurrency: boolean;
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
    rows: OverviewRow[];
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
    const rows: OverviewRow[] = [];
    for (const account of accounts) {
        const start = initialInDisplay(account, displayCurrency, rates);
        const own = byAccount.get(account.id) ?? [];
        const flow = accountBalance({ currency: displayCurrency, initialBalance: 0 }, own, rates);
        const row: OverviewRow = {
            balance: start.value + flow.total,
            exact: start.exact && flow.exact,
            id: account.id,
            kind: toAccountKind(account.kind),
            multiCurrency: isMultiCurrency(flow.composition, account.currency),
        };
        rows.push(row);
        balances.push({ balance: row.balance, kind: row.kind });
        exact &&= row.exact;
    }
    const worth = netWorth(balances);
    return { count: accounts.length, exact, owe: worth.owe, own: worth.own, rows, total: worth.net };
}

/** `exact` is false when no rate reached the display currency and the opening is left out. */
export interface DisplayedBalance {
    exact: boolean;
    value: number;
}

export function initialInDisplay(
    account: OverviewAccount,
    displayCurrency: string,
    rates: RateTable
): DisplayedBalance {
    if (account.currency === displayCurrency || account.initialBalance === 0) {
        return { exact: true, value: account.initialBalance };
    }
    const converted =
        account.initialBalanceUsd == null
            ? null
            : convertUsdSum(
                  account.initialBalanceUsd,
                  utcDateString(account.initialBalanceDate.getTime()),
                  displayCurrency,
                  rates
              );
    return converted == null ? { exact: false, value: 0 } : { exact: true, value: converted };
}
