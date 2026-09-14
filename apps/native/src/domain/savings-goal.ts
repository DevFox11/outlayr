/**
 * A goal is a target on an account, not a second ledger.
 *
 * The alternative — recording contributions against a goal — would put a
 * parallel record of the same money beside the account that already holds it,
 * and the two would disagree the first time someone moved money without saying
 * it was a contribution. Progress is the account's balance, so it cannot drift
 * from what the account says.
 *
 * Every goal carries a date. A target with no deadline has no pace, and the pace
 * is the only forward-looking number the app can give — see {@link goalProgress}.
 */

import { addLocalDays, daysBetween, startOfLocalDay } from "./local-day";

interface GoalPace {
    /** Whole months left, floored at zero on or after the target date. */
    monthsLeft: number;
    /** What to set aside each month to land on the target date. */
    perMonth: number;
}

/**
 * How far off the line still counts as on pace: one day of what the goal
 * demands, floored at one unit of its currency.
 *
 * A fixed unit is too tight to be useful. The line the date demands climbs every
 * hour, so a $6,000 goal set this morning and not yet contributed to is already
 * "$1.14 short" by lunchtime and stays visibly behind for good — a true figure
 * that reads as a verdict it has not earned. Anything inside a single day's
 * drift is not yet a verdict; the floor keeps a very short or very small goal
 * from getting a sub-cent band.
 */
function onPaceBand(target: number, startAmount: number, totalDays: number): number {
    return round(Math.max(1, Math.abs(target - startAmount) / totalDays));
}

interface GoalStanding {
    /**
     * Signed distance from the line the date demands: positive is ahead.
     *
     * This is the measure a bank app cannot give, because it needs both anchors —
     * where the account stood when the goal was set, and where the date wants it
     * today.
     */
    against: number;
    /** 0 to 1 of the goal's own span that has elapsed, clamped. */
    elapsed: number;
    /** What the straight line from the starting balance to the target wants today. */
    expected: number;
    /** True while `against` is inside {@link ON_PACE_BAND} either way. */
    onPace: boolean;
}

export interface GoalProgress {
    /** 0 to 1, clamped. An overdrawn account reads as no progress, not negative. */
    fraction: number;
    /** Null once the goal is reached: nothing is still being asked for. */
    pace: GoalPace | null;
    reached: boolean;
    /** Never negative: past the target the goal is done, not over-saved. */
    remaining: number;
    /**
     * Null once reached, and null when the goal's own span is degenerate — a goal
     * created on its target date has no line to be ahead or behind of.
     */
    standing: GoalStanding | null;
}

export interface GoalSpan {
    now?: Date;
    /** The account's balance when the goal was set, frozen at that write. */
    startAmount: number;
    startDate: Date;
    targetDate: Date;
}

const MS_PER_DAY = 86_400_000;
const REQUIRED_LINE_SAMPLES = 24;

const DAYS_PER_MONTH = 30.44;

/**
 * Where an account stands against its target, the pace that would land it on the
 * date, and whether it is ahead of or behind that pace.
 *
 * The pace is the point of the feature. A target with no sense of what it
 * demands per month is a wish; "$340 a month" is a decision the owner can act
 * on. The standing is what makes the goal worth opening a second time: it is the
 * difference between "you have $2,140" and "you are $212 ahead of the date".
 */
export function goalProgress(saved: number, target: number, span?: GoalSpan): GoalProgress {
    if (!(Number.isFinite(target) && target > 0)) {
        return { fraction: 0, pace: null, reached: false, remaining: 0, standing: null };
    }

    const held = Number.isFinite(saved) ? Math.max(0, saved) : 0;
    const remaining = Math.max(0, round(target - held));
    const reached = remaining === 0;
    const fraction = reached ? 1 : Math.min(1, held / target);

    if (span === undefined) {
        return { fraction, pace: null, reached, remaining, standing: null };
    }

    return {
        fraction,
        pace: reached ? null : paceFor(remaining, span),
        reached,
        remaining,
        standing: reached ? null : standingFor(held, target, span),
    };
}

function paceFor(remaining: number, { now, targetDate }: GoalSpan): GoalPace {
    const from = now ?? new Date();
    const days = (targetDate.getTime() - from.getTime()) / MS_PER_DAY;
    const monthsLeft = Math.max(0, Math.floor(days / DAYS_PER_MONTH));
    // On or past the date with money still to find, the whole remainder is due
    // now — dividing by a zero or negative horizon would report Infinity, and
    // "everything, now" is both true and the more useful thing to read.
    return { monthsLeft, perMonth: monthsLeft === 0 ? remaining : round(remaining / monthsLeft) };
}

/**
 * Never negative, matching `held`. A goal opened on an overdrawn or liability
 * account would otherwise start its line a thousand below zero while the balance
 * above it was clamped to zero — reporting the debt's own magnitude as an
 * immediate lead. An account in the red has put nothing aside, at either end.
 */
function normalisedStart(startAmount: number): number {
    return Number.isFinite(startAmount) ? Math.max(0, startAmount) : 0;
}

function standingFor(
    held: number,
    target: number,
    { now, startAmount, startDate, targetDate }: GoalSpan
): GoalStanding | null {
    // Whole LOCAL days, not instants. The line is modelled as advancing continuously,
    // but nothing tells the app the hour has changed: `useNow` publishes at local
    // midnight, on a ledger write and on resume, and has no intraday timer. A
    // standing read at instant granularity is therefore only correct at the moment
    // it is computed and drifts for as long as the screen stays open.
    //
    // Measuring in days makes the figure honest AND makes it move exactly when the
    // app already knows to look again. It is also the granularity everything else
    // about a goal uses: a per-day balance series, whole months left, a per-month
    // pace. `goal-pace-geometry` places the chart head on the same footing.
    const from = startOfLocalDay((now ?? new Date()).getTime());
    const opened = startOfLocalDay(startDate.getTime());
    // Counted in calendar days rather than measured in milliseconds: a span
    // crossing a clock shift is an hour longer or shorter than a whole number of
    // days, and dividing the raw difference reports 24/47 of a two-day goal.
    const totalDays = daysBetween(opened, startOfLocalDay(targetDate.getTime()));
    if (totalDays <= 0) {
        return null;
    }
    const elapsed = Math.min(1, Math.max(0, daysBetween(opened, from) / totalDays));
    // Clamped to the target: past the date the line has arrived, and "behind" then
    // means the whole remainder, which is exactly what the pace already says.
    const start = normalisedStart(startAmount);
    const expected = round(start + (target - start) * elapsed);
    const against = round(held - expected);
    return {
        against,
        elapsed,
        expected,
        // The normalised start, not the raw one: the band has to describe the line
        // that is actually drawn. A -1,000 → 4,000 goal climbs 40 a day once the
        // anchor is clamped, and measuring its tolerance against the unclamped
        // 5,000 span would call a balance a full day behind "on pace".
        // `<=`, so a FULL day of drift is tolerated rather than merely less than
        // one. Now that the line advances in whole days, a goal set yesterday and
        // not yet contributed to sits exactly one day behind — the commonest state
        // a new goal is in, and not a verdict it has earned.
        onPace: Math.abs(against) <= onPaceBand(target, start, totalDays),
    };
}

/**
 * The line the target date demands, sampled evenly. Used as the reference the
 * account's own balance is drawn against.
 *
 * Sampled rather than drawn as two points because the chart clips it against the
 * plot's own domain, and a two-point path would cut the corner on any axis that
 * does not contain both ends.
 */
export function goalRequiredLine(
    { startAmount, startDate, targetDate }: Pick<GoalSpan, "startAmount" | "startDate" | "targetDate">,
    target: number
): { time: number; value: number }[] {
    // Day-normalised at both ends, like the standing. Interpolating over the raw
    // instants instead put the drawn line half a day out of step with the figure
    // beside it whenever a goal was made at a different time of day from its
    // deadline — the chart's own head sits on a day boundary, so its reference
    // has to as well.
    const opened = startOfLocalDay(startDate.getTime());
    const due = startOfLocalDay(targetDate.getTime());
    const totalDays = daysBetween(opened, due);
    if (totalDays <= 0) {
        return [{ time: due, value: target }];
    }
    // The same normalisation the standing uses, so the drawn line and the figure
    // beside it start from one anchor.
    const start = normalisedStart(startAmount);
    const points: { time: number; value: number }[] = [];
    // Sampled on calendar-day ordinals, positions AND values alike. Deriving them
    // from the raw span put the line at 24/47 of the target on the middle day of a
    // spring-forward span while the figure beside it said one half.
    const steps = Math.min(REQUIRED_LINE_SAMPLES, totalDays);
    for (let step = 0; step <= steps; step += 1) {
        const ordinal = Math.round((step * totalDays) / steps);
        points.push({
            time: addLocalDays(opened, ordinal),
            value: start + (target - start) * (ordinal / totalDays),
        });
    }
    return points;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
