import { type BudgetWindow, previousPeriodStart } from "./budget-math";

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
	/**
	 * Signed. Positive is unspent allowance the current window inherits; negative
	 * is an overspend still being paid off. Both directions carry, or the figure
	 * would reward overspending by forgetting it.
	 */
	credit: number;
	/** How many closed windows it was summed over. */
	periods: number;
	/** Whether the walk stopped at {@link MAX_CARRY_PERIODS} before the anchor. */
	clamped: boolean;
}

export interface CarryInput {
	/** Where the budget started counting. */
	anchor: Date;
	/** The window currently on screen; everything before it is closed. */
	current: BudgetWindow;
	type: number;
	/** The target for one window. */
	limit: number;
	/** What was spent in `[start, end)` of a closed window. */
	spentIn: (start: Date, end: Date) => number;
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
export function rolloverCarry({
	anchor,
	current,
	type,
	limit,
	spentIn,
}: CarryInput): RolloverCarry {
	let credit = 0;
	let periods = 0;
	let end = current.start;
	while (periods < MAX_CARRY_PERIODS) {
		const start = previousPeriodStart(end, type);
		// A type whose period cannot step backwards would loop forever.
		if (start.getTime() >= end.getTime()) {
			return { credit, periods, clamped: false };
		}
		if (end.getTime() <= anchor.getTime()) {
			return { credit, periods, clamped: false };
		}
		credit += limit - spentIn(start, end);
		periods += 1;
		end = start;
	}
	return { credit, periods, clamped: true };
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
