import { accountBalanceSeries } from "./account-balance-series";
import type { AccountBalanceSeriesAccount } from "./account-balance-series";
import { initialInDisplay } from "./account-display";
import type { CurrencyCell } from "./currency-totals";
import type { RateTable } from "./valuation";

export interface NetWorthSeriesAccount extends AccountBalanceSeriesAccount {
    id: string;
    /** Frozen at write, and what makes a foreign opening balance convertible. */
    initialBalanceUsd: number | null;
}

export interface NetWorthSeriesPoint {
    date: string;
    /** False once any account's value on that day fell back to face value. */
    exact: boolean;
    value: number;
}

/**
 * Net worth over the same window the per-account chart uses, as the sum of
 * every account's balance on each day.
 *
 * Summing the per-account series rather than re-deriving is what keeps a
 * transfer honest: its two legs are already opposite cells on two accounts, so
 * they cancel on any day both are counted. Re-implementing the walk here would
 * put a second definition of "balance" in the app, and the first day they
 * disagreed the chart would contradict the accounts under it.
 *
 * Accounts do not share a start: each series begins at its own opening date.
 * A day before an account existed contributes nothing, and a day after its last
 * point carries that point forward — which is what makes the line continuous
 * rather than dropping every time one account's series runs out.
 */
export function netWorthSeries(
    accounts: readonly NetWorthSeriesAccount[],
    cellsByAccount: ReadonlyMap<string, readonly CurrencyCell[]>,
    rates: RateTable,
    now: Date,
    displayCurrency: string
): NetWorthSeriesPoint[] {
    if (accounts.length === 0) {
        return [];
    }

    // Valued into the display currency rather than each account's own, or the sum
    // would add bolivares to dollars. The opening balance converts through the
    // same frozen `initialBalanceUsd` the accounts card uses.
    const perAccount = accounts.map((account) => {
        const opening = initialInDisplay(account, displayCurrency, rates);
        const series = accountBalanceSeries(account, cellsByAccount.get(account.id) ?? [], rates, now, {
            currency: displayCurrency,
            opening: opening.value,
        });
        return {
            byDate: new Map(series.map((point) => [point.date, point])),
            openingExact: opening.exact,
        };
    });

    const dates = new Set<string>();
    for (const { byDate } of perAccount) {
        for (const date of byDate.keys()) {
            dates.add(date);
        }
    }

    const points: NetWorthSeriesPoint[] = [];
    // One cursor per account rather than a lookup per day: the series are already
    // sorted, so carrying forward is a walk, not a search.
    const carried = perAccount.map(() => ({ exact: true, seen: false, value: 0 }));
    for (const date of [...dates].sort()) {
        let value = 0;
        let exact = true;
        for (const [index, { byDate }] of perAccount.entries()) {
            const point = byDate.get(date);
            if (point != null) {
                carried[index] = {
                    exact: point.exact && perAccount[index].openingExact,
                    seen: true,
                    value: point.value,
                };
            }
            const held = carried[index];
            // An account that has not opened yet holds nothing, and is not a reason
            // to call the day approximate.
            if (held.seen) {
                value += held.value;
                exact &&= held.exact;
            }
        }
        points.push({ date, exact, value });
    }
    return points;
}
