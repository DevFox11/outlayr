import { addDays, startOfDay } from "./dates";

/**
 * Mirrors the Swift `RecurringCadence` raw values so a transaction's persisted
 * `recurringType` reads identically across the two apps.
 */
export const RECURRING_TYPE = {
    daily: 1,
    monthly: 3,
    none: 0,
    weekly: 2,
    yearly: 4,
} as const;

export type RecurringType = (typeof RECURRING_TYPE)[keyof typeof RECURRING_TYPE];

/** In the order the picker renders them. */
export const SELECTABLE_RECURRING_TYPES: readonly RecurringType[] = [
    RECURRING_TYPE.daily,
    RECURRING_TYPE.weekly,
    RECURRING_TYPE.monthly,
    RECURRING_TYPE.yearly,
];

/**
 * A subscription needs a cadence to walk forward. Only fires when the type is
 * still `none` — re-entering subscription mode after toggling it off must not
 * clobber a cadence the user already chose.
 */
export function ensureRecurringType(type: number): number {
    return type === RECURRING_TYPE.none ? RECURRING_TYPE.monthly : type;
}

const UNIT_SINGULAR: Record<number, string> = {
    1: "day",
    2: "week",
    3: "month",
    4: "year",
};

export function cadenceUnit(type: number): string {
    return UNIT_SINGULAR[type] ?? "month";
}

/** Adds `n` whole months, landing on `anchorDay` where the target month allows. */
function addMonths(date: Date, n: number, anchorDay: number): Date {
    const d = new Date(date);
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(anchorDay, lastDay));
    return d;
}

function normalizeAnchor(anchorDay: number | null | undefined, from: Date) {
    if (anchorDay == null) {
        return from.getDate();
    }
    return Math.min(31, Math.max(1, Math.round(anchorDay)));
}

/**
 * The next occurrence after `from`, or `null` when the type is non-recurring.
 * Day/week advance by exact days; month/year advance by calendar units clamped
 * to a valid day-of-month.
 *
 * `anchorDay` is the day the schedule was written for, which a short month can
 * pull a given occurrence off. Passing it is what lets the 31st come back in
 * March after February clamped it to the 28th; omitting it anchors to `from`'s
 * own day, which is the same thing for any schedule that has never clamped.
 */
export function nextDate(from: Date, type: number, coefficient: number, anchorDay?: number | null): Date | null {
    const n = Math.max(1, Math.round(coefficient));
    const anchor = normalizeAnchor(anchorDay, from);
    switch (type) {
        case RECURRING_TYPE.daily: {
            return addDays(from, n);
        }
        case RECURRING_TYPE.weekly: {
            return addDays(from, 7 * n);
        }
        case RECURRING_TYPE.monthly: {
            return addMonths(from, n, anchor);
        }
        case RECURRING_TYPE.yearly: {
            return addMonths(from, 12 * n, anchor);
        }
        default: {
            return null;
        }
    }
}

/** Alias for {@link nextDate}. */
export const next = nextDate;

export interface ScheduledCharge {
    /** The target month was too short to hold the anchor day, so this one moved. */
    clamped: boolean;
    date: Date;
}

/**
 * The next `count` charges after `firstPayment`, walked exactly as the back-fill
 * walks them so what the form promises is what the ledger later writes.
 */
export function schedulePreview(
    firstPayment: Date,
    type: number,
    coefficient: number,
    count: number
): ScheduledCharge[] {
    const anchorDay = firstPayment.getDate();
    const charges: ScheduledCharge[] = [];
    let holding = firstPayment;

    for (let i = 0; i < count; i += 1) {
        const advanced = nextDate(holding, type, coefficient, anchorDay);
        if (advanced == null) {
            break;
        }
        charges.push({
            clamped:
                (type === RECURRING_TYPE.monthly || type === RECURRING_TYPE.yearly) && advanced.getDate() !== anchorDay,
            date: advanced,
        });
        holding = advanced;
    }

    return charges;
}

/** The largest interval the schedule will accept. */
export const MAX_INTERVAL = 30;

/**
 * The first occurrence of `from`'s schedule strictly after today, or null when
 * the schedule cannot advance or has run past its end date. `from` counts as a
 * member of its own schedule, so a charge still ahead of today is the landing
 * rather than something to step past — anything else would name the charge one
 * whole cadence beyond the one the ledger is about to take.
 *
 * Walked rather than projected so month-length clamping matches every occurrence
 * the back-fill writes.
 */
export function nextLanding(
    from: Date,
    type: number,
    coefficient: number,
    endDate: Date | null,
    now: Date,
    anchorDay?: number | null
): Date | null {
    const today = startOfDay(now);
    const endLimit = endDate == null ? null : startOfDay(endDate);
    const anchor = normalizeAnchor(anchorDay, from);
    const advance = (at: Date): Date | null => nextDate(at, type, coefficient, anchor);
    const pastEndLimit = (at: Date): boolean => endLimit != null && startOfDay(at).getTime() > endLimit.getTime();

    // A row with no cadence has no schedule to land on, checked before `from`
    // itself is considered so a future-dated one-off can never be mistaken for a
    // pending subscription charge.
    if (advance(from) == null) {
        return null;
    }

    // Strictly after, never on: `scheduleSuccessor` hands this a carrier dated
    // today-or-earlier, and returning a same-day `from` would make it the
    // successor of itself and stall the chain on one charge forever.
    if (startOfDay(from).getTime() > today.getTime()) {
        return pastEndLimit(from) ? null : from;
    }

    let holding = from;
    let advanced = advance(holding);
    while (advanced != null && startOfDay(advanced).getTime() > startOfDay(holding).getTime()) {
        if (pastEndLimit(advanced)) {
            return null;
        }
        if (startOfDay(advanced).getTime() > today.getTime()) {
            return advanced;
        }
        holding = advanced;
        advanced = advance(holding);
    }
    return null;
}
