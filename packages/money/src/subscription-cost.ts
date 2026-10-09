import { startOfDay } from "./calendar";
import { currencyTotals } from "./currency-totals";
import type { CurrencyBucket, CurrencyEntry } from "./currency-totals";
import { RECURRING_TYPE } from "./recurrence";
import type { RateTable } from "./valuation";

export interface ScheduleCostEntry extends CurrencyEntry {
    recurringCoefficient: number;
    /** When the owner gave the schedule an end; null means it runs indefinitely. */
    recurringEndDate?: Date | null;
    recurringType: number;
}

/**
 * How many times a month a schedule charges — a fraction, since most cadences
 * do not divide the month evenly.
 *
 * The year is taken as 365 days and 52 weeks. Those two disagree by a day,
 * which is the price of a figure that holds still instead of drifting with
 * whichever month the user happens to open the app in.
 */
export function monthlyChargeCount(recurringType: number, recurringCoefficient: number): number {
    // Normalized exactly as `nextDate` does, so the count and the dates the
    // back-fill actually writes always describe the same schedule.
    const every = Math.max(1, Math.round(recurringCoefficient));
    switch (recurringType) {
        case RECURRING_TYPE.daily: {
            return 365 / 12 / every;
        }
        case RECURRING_TYPE.weekly: {
            return 52 / 12 / every;
        }
        case RECURRING_TYPE.monthly: {
            return 1 / every;
        }
        case RECURRING_TYPE.yearly: {
            return 1 / (12 * every);
        }
        default: {
            return 0;
        }
    }
}

/**
 * What a set of schedules costs per month, per currency. Every schedule is
 * normalized to one monthly charge whatever its cadence, so face values are not
 * comparable across entries without it.
 *
 * A retired schedule is dropped rather than added as a zero: counting it would
 * pad the count and, worse, open a bucket for a currency nothing recurs in. One
 * whose end date has passed is dropped for the same reason — it is a commitment
 * the owner has already ended, and leaving it in reports money they will never
 * be charged again.
 *
 * Never one blended number — the buckets come from {@link currencyTotals}, the
 * same contract every other aggregate on this screen honours.
 */
export function monthlySubscriptionCost(
    schedules: readonly ScheduleCostEntry[],
    globalCurrency: string,
    rates?: RateTable,
    now: Date = new Date()
): CurrencyBucket[] {
    const perMonth: CurrencyEntry[] = [];
    for (const schedule of schedules) {
        const charges = monthlyChargeCount(schedule.recurringType, schedule.recurringCoefficient);
        if (charges === 0 || schedule.income) {
            continue;
        }
        const endsAt = schedule.recurringEndDate;
        if (endsAt != null && startOfDay(endsAt).getTime() < startOfDay(now).getTime()) {
            continue;
        }
        perMonth.push({
            amount: schedule.amount * charges,
            // Scaled alongside the face amount, or a converted bucket would hold a
            // month of the schedule in one currency and a single charge in another.
            amountUsd: schedule.amountUsd == null ? null : schedule.amountUsd * charges,
            currency: schedule.currency,
            date: schedule.date,
            income: schedule.income,
        });
    }
    return currencyTotals(perMonth, globalCurrency, rates);
}
