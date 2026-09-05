import type { ExpenseContribution } from "@/data/budget-spent";

import { previousPeriodStart } from "./budget-math";
import type { BudgetWindow } from "./budget-math";
import { median } from "./stats";

/**
 * How many closed windows a typical figure is drawn from.
 *
 * Six months is far enough back to survive a holiday or a move without being so
 * far that a raise or a new city still counts. The same sample answers "how many
 * of the last six went over", which is why the two are one walk.
 */
const TYPICAL_LOOKBACK = 6;

export interface TypicalInput {
    /** The window a limit is being placed on. Everything before it is closed. */
    current: BudgetWindow;
    /** How many closed windows to walk back over. Defaults to {@link TYPICAL_LOOKBACK}. */
    lookback?: number;
    /** Where the ledger's own history starts; the walk stops once it passes this. */
    since?: Date | null;
    /** What was spent in `[start, end)` of a closed window. */
    spentIn: (start: Date, end: Date) => number;
    type: number;
}

export interface TypicalSpend {
    /**
     * Spend per closed window sampled, newest first, zeros included. `windowsOver`
     * counts against this: a window with nothing spent did not go over.
     */
    readonly history: readonly number[];
    /**
     * The median of the windows that held spending, or null when none did.
     *
     * Zero windows are excluded on purpose. A category used in two months of six
     * has a median of 0 once the empty ones are padded in, and "typically $0"
     * is worse than saying nothing — the same reason `budget-burndown`'s daily
     * rate refuses to median over a zero-padded calendar.
     */
    readonly typical: number | null;
}

/**
 * What one scope usually costs per window, and what each recent window cost.
 *
 * Walks backwards from the current window, which is deliberately excluded: it is
 * still being spent in, and a partial window would drag the median down by
 * however much of it is left.
 *
 * Pure, and cheap by construction — `useExpenseContributions` already holds
 * every non-deleted expense in memory, so `spentIn` is an array pass, not a
 * query.
 */
export function typicalSpend({
    current,
    type,
    spentIn,
    lookback = TYPICAL_LOOKBACK,
    since,
}: TypicalInput): TypicalSpend {
    const history = closedWindowsBefore({ count: lookback, current, since, type }).map((window) =>
        spentIn(window.start, window.end)
    );
    return { history, typical: typicalOf(history) };
}

/** How many of the sampled windows spent more than `limit`. */
export function windowsOver(history: readonly number[], limit: number): number {
    return history.reduce((count, spent) => (spent > limit ? count + 1 : count), 0);
}

/** See {@link TypicalSpend.typical}. */
export function typicalOf(history: readonly number[]): number | null {
    return median(history.filter((spent) => spent > 0));
}

/** The closed windows behind `current`, newest first. */
export function closedWindowsBefore({
    current,
    type,
    count = TYPICAL_LOOKBACK,
    since,
}: {
    count?: number;
    current: BudgetWindow;
    since?: Date | null;
    type: number;
}): BudgetWindow[] {
    const windows: BudgetWindow[] = [];
    const floor = since?.getTime() ?? Number.NEGATIVE_INFINITY;
    let end = current.start;

    while (windows.length < count) {
        const start = previousPeriodStart(end, type);
        // A type whose period cannot step backwards would loop forever.
        if (start.getTime() >= end.getTime() || end.getTime() <= floor) {
            break;
        }
        windows.push({ end, start });
        end = start;
    }
    return windows;
}

/** The key {@link spendPerWindow} files an expense under whatever its category. */
export const EVERY_SCOPE = "*";

/**
 * Spend per scope per window, newest window first, in one pass over the ledger.
 *
 * The rail asks the same question of every category at once, and asking it one
 * category at a time is `categories x windows` passes over an array that holds
 * the whole ledger. A subcategory's spend lands under its parent as well as
 * itself, matching `contributesTo`, so a parent's figure covers its children.
 */
export function spendPerWindow(
    rows: readonly ExpenseContribution[],
    windows: readonly BudgetWindow[]
): Map<string, number[]> {
    const totals = new Map<string, number[]>();
    const add = (key: string, index: number, amount: number) => {
        let series = totals.get(key);
        if (!series) {
            series = Array.from({ length: windows.length }, () => 0);
            totals.set(key, series);
        }
        series[index] = (series[index] ?? 0) + amount;
    };

    for (const row of rows) {
        const at = row.date.getTime();
        for (const [index, window] of windows.entries()) {
            if (at < window.start.getTime() || at >= window.end.getTime()) {
                continue;
            }
            add(EVERY_SCOPE, index, row.amount);
            if (row.categoryId) {
                add(row.categoryId, index, row.amount);
            }
            if (row.parentId) {
                add(row.parentId, index, row.amount);
            }
            break;
        }
    }
    return totals;
}
