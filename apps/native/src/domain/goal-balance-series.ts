import type { AccountBalanceInput } from "@outlayr/money/account-balance";
import { restate } from "@outlayr/money/account-overview";
import { valueCell } from "@outlayr/money/currency-totals";
import type { CurrencyCell } from "@outlayr/money/currency-totals";
import type { RateTable } from "@outlayr/money/valuation";

/** A cell that knows where it is drawn as well as where it was valued. */
export type PlottedCell = CurrencyCell & { plotDay: string };

export interface GoalBalancePoint {
    /** Local midnight of the day, matching everything else a goal is measured on. */
    time: number;
    value: number;
}

/**
 * The account's balance across a goal's own span, one point per LOCAL day.
 *
 * Not `accountBalanceSeries`, which buckets by UTC day. Outside UTC that puts a
 * Friday evening deposit in Saturday's bucket and then draws it at Saturday's
 * midnight — Friday afternoon locally, BEFORE the deposit that caused it. A goal
 * is read on local days throughout, so its history has to be cut on them too.
 *
 * This is a running presentation of `balanceIn`, not a second definition of a
 * balance: each cell is valued into the account's currency by the same
 * `valueCell`, and each day's total is restated at that day's rate the way
 * `balanceIn` restates today's.
 */
export function goalBalanceSeries(
    cells: readonly PlottedCell[],
    account: AccountBalanceInput,
    displayCurrency: string,
    rates: RateTable,
    sinceMs: number
): GoalBalancePoint[] {
    const byDay = new Map<string, number>();
    for (const cell of cells) {
        const net = (cell.income ? 1 : -1) * valueCell(cell, account.currency, rates);
        byDay.set(cell.plotDay, (byDay.get(cell.plotDay) ?? 0) + net);
    }

    const points: GoalBalancePoint[] = [];
    let running = account.initialBalance;
    // `YYYY-MM-DD` keys sort lexically exactly as they sort chronologically.
    for (const day of [...byDay.keys()].sort()) {
        running += byDay.get(day) ?? 0;
        const time = localMidnightOf(day);
        // Days before the goal existed still move the running total — they are what
        // the account held when it started — but they are not part of its line.
        if (time >= sinceMs) {
            points.push({ time, value: restate(running, account.currency, displayCurrency, day, rates).value });
        }
    }
    return points;
}

/** A `YYYY-MM-DD` key, read as the local day it names. */
function localMidnightOf(dateKey: string): number {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
}
