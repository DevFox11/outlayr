/**
 * A goal is a target on an account, not a second ledger.
 *
 * The alternative — recording contributions against a goal — would put a
 * parallel record of the same money beside the account that already holds it,
 * and the two would disagree the first time someone moved money without saying
 * it was a contribution. Progress is the account's balance, so it cannot drift
 * from what the account says.
 */

export interface GoalPace {
	/** Whole months left, floored at zero on or after the target date. */
	monthsLeft: number;
	/** What to set aside each month to land on the target date. */
	perMonth: number;
}

export interface GoalProgress {
	/** 0 to 1, clamped. An overdrawn account reads as no progress, not negative. */
	fraction: number;
	/** Null without a target date, or once the goal is reached. */
	pace: GoalPace | null;
	reached: boolean;
	/** Never negative: past the target the goal is done, not over-saved. */
	remaining: number;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30.44;

/**
 * Where an account stands against its target, and the pace that would land it
 * on the date.
 *
 * The pace is the point of the feature. A target with no sense of what it
 * demands per month is a wish; "$340 a month" is a decision the owner can act
 * on, and it is the one forward-looking number the app has.
 */
export function goalProgress(
	saved: number,
	target: number,
	options: { now?: Date; targetDate?: Date | null } = {}
): GoalProgress {
	if (!(Number.isFinite(target) && target > 0)) {
		return { fraction: 0, pace: null, reached: false, remaining: 0 };
	}

	const held = Number.isFinite(saved) ? Math.max(0, saved) : 0;
	const remaining = Math.max(0, round(target - held));
	const reached = remaining === 0;
	const fraction = reached ? 1 : Math.min(1, held / target);

	return { fraction, pace: paceFor(remaining, reached, options), reached, remaining };
}

function paceFor(
	remaining: number,
	reached: boolean,
	{ now, targetDate }: { now?: Date; targetDate?: Date | null }
): GoalPace | null {
	if (reached || targetDate == null) {
		return null;
	}
	const from = now ?? new Date();
	const days = (targetDate.getTime() - from.getTime()) / MS_PER_DAY;
	const monthsLeft = Math.max(0, Math.floor(days / DAYS_PER_MONTH));
	// On or past the date with money still to find, the whole remainder is due
	// now — dividing by a zero or negative horizon would report Infinity, and
	// "everything, now" is both true and the more useful thing to read.
	return { monthsLeft, perMonth: monthsLeft === 0 ? remaining : round(remaining / monthsLeft) };
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
