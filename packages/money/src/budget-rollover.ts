import { contributesTo } from "./budget-spent";
import type { ExpenseContribution } from "./budget-spent";
import { previousPeriodStart } from "./budget-window";
import type { BudgetWindow } from "./budget-window";

/**
 * The most closed windows a carry is computed over.
 *
 * A budget's anchor can predate the ledger by years, and the carry is summed one
 * window at a time, so the walk needs a ceiling that does not depend on how long
 * ago the budget was created. Far past any window a person browses, and the
 * clamp is reported rather than silent — see {@link RolloverCarry.clamped}.
 */
export const MAX_CARRY_PERIODS = 120;

export interface RolloverCarry {
    /** Whether the walk stopped at {@link MAX_CARRY_PERIODS} before the anchor. */
    clamped: boolean;
    /**
     * Signed. Positive is unspent allowance the current window inherits; negative
     * is an overspend still being paid off. Both directions carry, or the figure
     * would reward overspending by forgetting it.
     */
    credit: number;
    /** How many closed windows it was summed over. */
    periods: number;
}

export interface CarryInput {
    /** Where the budget started counting. */
    anchor: Date;
    /** The window currently on screen; everything before it is closed. */
    current: BudgetWindow;
    /** The target for one window. */
    limit: number;
    /** What was spent in `[start, end)` of a closed window. */
    spentIn: (start: Date, end: Date) => number;
    type: number;
}

/** The closed windows a carry is summed over, newest first, back to the anchor. */
export function carryWindows({ anchor, current, type }: Omit<CarryInput, "limit" | "spentIn">) {
    const windows: BudgetWindow[] = [];
    let end = current.start;
    while (windows.length < MAX_CARRY_PERIODS) {
        const start = previousPeriodStart(end, type);
        // A type whose period cannot step backwards would loop forever.
        if (start.getTime() >= end.getTime() || end.getTime() <= anchor.getTime()) {
            return { clamped: false, windows };
        }
        windows.push({ end, start });
        end = start;
    }
    return { clamped: true, windows };
}

/**
 * What the current window inherits from the ones before it.
 *
 * Walks backwards from the current window to the anchor, adding `limit - spent`
 * for each closed window on the way. Backwards rather than forwards because the
 * anchor is the uncertain end: it can predate the ledger, while the current
 * window is always known.
 *
 * A window that has not closed contributes nothing — the current one is being
 * spent in, and crediting it against itself would count the same allowance
 * twice.
 */
export function rolloverCarry({ limit, spentIn, ...walk }: CarryInput): RolloverCarry {
    const { clamped, windows } = carryWindows(walk);
    let credit = 0;
    for (const { start, end } of windows) {
        credit += limit - spentIn(start, end);
    }
    return { clamped, credit, periods: windows.length };
}

/**
 * {@link rolloverCarry} over ledger rows, filing each row under its closed window
 * in one pass rather than one pass per window. A null `categoryId` is the overall
 * budget. Each window adds the same rows in the same order as `spentForCategory`
 * or `spentForMain` over `[start, lastMsBefore(end)]`, so the credit is identical.
 */
export function rolloverCarryFrom(
    rows: readonly ExpenseContribution[],
    categoryId: string | null,
    input: Omit<CarryInput, "spentIn">
): RolloverCarry {
    const { windows } = carryWindows(input);
    const starts = windows.map(({ start }) => start.getTime());
    const sums = starts.map(() => 0);
    const newestEnd = windows[0]?.end.getTime() ?? Number.NEGATIVE_INFINITY;
    const oldestStart = starts.at(-1) ?? Number.POSITIVE_INFINITY;
    for (const row of rows) {
        const at = row.date.getTime();
        if (at < oldestStart || at >= newestEnd || !contributesTo(row, categoryId)) {
            continue;
        }
        // The windows are contiguous and newest first.
        const index = starts.findIndex((start) => at >= start);
        sums[index] = (sums[index] ?? 0) + row.amount;
    }
    const spentByStart = new Map(starts.map((start, index) => [start, sums[index] ?? 0]));
    return rolloverCarry({ ...input, spentIn: (start) => spentByStart.get(start.getTime()) ?? 0 });
}

/**
 * The limit the current window actually runs on.
 *
 * Floored at zero: an overspend deep enough to swallow a whole window would
 * otherwise produce a negative target, and every rail, percentage and "left this
 * period" figure downstream reads a negative limit as nonsense rather than as
 * debt. The debt is not forgotten — it is still in {@link RolloverCarry.credit},
 * which is what the screen shows.
 */
export function effectiveLimit(limit: number, carry: number): number {
    return Math.max(0, limit + carry);
}
