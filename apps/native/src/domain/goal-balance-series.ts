import { valueCell } from "./currency-totals";
import type { CurrencyCell } from "./currency-totals";
import type { RateTable } from "./valuation";

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
 * This is a running presentation of `accountBalance`'s valuation, not a second
 * definition of it: each cell is valued by the same `valueCell` that function
 * uses, and the total of every point is the total that function returns.
 */
export function goalBalanceSeries(
    cells: readonly PlottedCell[],
    currency: string,
    rates: RateTable,
    opening: number,
    sinceMs: number
): GoalBalancePoint[] {
    const byDay = new Map<number, number>();
    for (const cell of cells) {
        const day = localMidnightOf(cell.plotDay);
        const net = (cell.income ? 1 : -1) * valueCell(cell, currency, rates);
        byDay.set(day, (byDay.get(day) ?? 0) + net);
    }

    const points: GoalBalancePoint[] = [];
    let running = opening;
    for (const day of [...byDay.keys()].sort((left, right) => left - right)) {
        running += byDay.get(day) ?? 0;
        // Days before the goal existed still move the running total — they are what
        // the account held when it started — but they are not part of its line.
        if (day >= sinceMs) {
            points.push({ time: day, value: running });
        }
    }
    return points;
}

/** A `YYYY-MM-DD` key, read as the local day it names. */
function localMidnightOf(dateKey: string): number {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
}
