import { restate } from "@outlayr/money/account-overview";
import { utcDateString } from "@outlayr/money/dates";
import type { RateTable } from "@outlayr/money/valuation";

import { accountBalanceSeries } from "./account-balance-series";
import type { AccountBalanceSeriesAccount } from "./account-balance-series";
import type { PlottedCell } from "./goal-balance-series";
import { localDayKey } from "./local-day";

export interface NetWorthSeriesAccount extends AccountBalanceSeriesAccount {
    id: string;
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
    cellsByAccount: ReadonlyMap<string, readonly PlottedCell[]>,
    rates: RateTable,
    now: Date,
    displayCurrency: string
): NetWorthSeriesPoint[] {
    if (accounts.length === 0) {
        return [];
    }

    // Each day restated into the display currency, or the sum would add bolivares
    // to dollars. Restated as a balance, at that day's rate, the way the accounts
    // card states today's: the line's last point is the card's total. The card
    // values now at its UTC day, which can be a day off the local one, so today's
    // point takes that rate too.
    const today = localDayKey(now.getTime());
    const todaysRate = utcDateString(now.getTime());
    const perAccount = accounts.map((account) => {
        const series = accountBalanceSeries(account, cellsByAccount.get(account.id) ?? [], rates, now);
        return {
            byDate: new Map(
                series.map((point) => {
                    const rateDate = point.date === today ? todaysRate : point.date;
                    const restated = restate(point.value, account.currency, displayCurrency, rateDate, rates);
                    return [point.date, { exact: point.exact && restated.exact, value: restated.value }];
                })
            ),
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
                carried[index] = { exact: point.exact, seen: true, value: point.value };
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
