import { accountBalance } from "./account-balance";
import type { AccountBalanceInput, AccountCompositionEntry } from "./account-balance";
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
    /** What the liability accounts and the people you owe add up to, stated positive. */
    owe: number;
    /** What the asset accounts hold, plus what people owe you. */
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
 * Every account's balance valued into the display currency at `now`'s rate and
 * summed. Null with no accounts, so the card can disappear rather than print a
 * zero. `rates` has to carry each account's currency beside the display one.
 */
export function accountsOverview(
    accounts: readonly OverviewAccount[],
    cells: readonly AccountCellRow[],
    displayCurrency: string,
    rates: RateTable,
    now: Date
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
    const today = utcDateString(now.getTime());
    for (const account of accounts) {
        const balance = balanceIn(account, byAccount.get(account.id) ?? [], displayCurrency, rates, today);
        const row: OverviewRow = {
            balance: balance.value,
            exact: balance.exact,
            id: account.id,
            kind: toAccountKind(account.kind),
            multiCurrency: isMultiCurrency(balance.composition, account.currency),
        };
        rows.push(row);
        balances.push({ balance: row.balance, kind: row.kind });
        exact &&= row.exact;
    }
    const worth = netWorth(balances);
    return { count: accounts.length, exact, owe: worth.owe, own: worth.own, rows, total: worth.net };
}

/** `exact` is false when part of the figure could not be valued. */
export interface DisplayedBalance {
    exact: boolean;
    value: number;
}

/**
 * An account's balance in the display currency on `dateKey`: summed in the
 * account's own currency, then restated once at that day's rate.
 *
 * A balance is what the account holds, so it moves with the rate. Converting the
 * opening and every entry at their own days instead needs a rate for every day
 * since the account opened, and the app keeps about 90: an older opening fell
 * out of the figure entirely.
 *
 * `rates` has to carry the account's currency beside the display one.
 */
export function balanceIn(
    account: AccountBalanceInput,
    cells: readonly CurrencyCell[],
    displayCurrency: string,
    rates: RateTable,
    dateKey: string
): DisplayedBalance & { composition: AccountCompositionEntry[] } {
    const own = accountBalance(account, cells, rates);
    const restated = restate(own.total, account.currency, displayCurrency, dateKey, rates);
    return { composition: own.composition, exact: own.exact && restated.exact, value: restated.value };
}

/**
 * `amount` of `from` restated in `to` through USD at `dateKey`'s rates.
 *
 * A day older than every rate held reads at the oldest one, flagged approximate:
 * nearer the truth than today's, and a line drawn through it stays continuous.
 * With no rate at all on either side the amount is left out.
 */
export function restate(amount: number, from: string, to: string, dateKey: string, rates: RateTable): DisplayedBalance {
    if (from === to) {
        return { exact: true, value: amount };
    }
    const onDay = convertBetween(amount, from, to, dateKey, rates);
    if (onDay !== null) {
        return { exact: true, value: onDay };
    }
    let floor = dateKey;
    for (const code of [from, to]) {
        if (code === "USD") {
            continue;
        }
        const earliest = rates.earliest(code);
        if (earliest === null) {
            return { exact: false, value: 0 };
        }
        if (earliest > floor) {
            floor = earliest;
        }
    }
    return { exact: false, value: convertBetween(amount, from, to, floor, rates) ?? 0 };
}

/** Null when either side has no rate on or before `dateKey`. */
function convertBetween(amount: number, from: string, to: string, dateKey: string, rates: RateTable): number | null {
    // A stored rate is currency-per-USD, so USD is the amount divided by it.
    const perUsd = from === "USD" ? 1 : rates.get(from, dateKey);
    if (perUsd === null || perUsd <= 0) {
        return null;
    }
    return convertUsdSum(amount / perUsd, dateKey, to, rates);
}
