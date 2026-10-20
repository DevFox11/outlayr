/**
 * The reader's own day boundary.
 *
 * A goal is measured in whole LOCAL days: `useNow` ticks at local midnight
 * (`nextClockTick`), and a date-only picker hands back a local midnight. Anything
 * comparing against those has to be cut on the same boundary, or it disagrees by
 * a time of day — which is how a deadline kept its creation hour, a projection
 * outlived a standing that had already expired, and tomorrow became unselectable.
 *
 * `setHours` rather than epoch arithmetic: flooring by the epoch gives a UTC day,
 * and the two days a year a clock shifts are 23 and 25 hours long.
 */
export function startOfLocalDay(ms: number): number {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/** The `YYYY-MM-DD` key of the local day `ms` falls on, the day SQLite's `'localtime'` cuts (`LOCAL_DAY`). */
export function localDayKey(ms: number): string {
    const date = new Date(ms);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight tomorrow — the earliest deadline a goal can be given. */
export function tomorrowLocal(nowMs: number = Date.now()): Date {
    const date = new Date(nowMs);
    date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);
    return date;
}

/**
 * Whole calendar days between two local-midnight readings.
 *
 * Rounded, not divided: the two days a year a clock shifts are 23 and 25 hours
 * long, so a span crossing one is not a whole number of 24-hour days. Both ends
 * are midnights, so the true count is never more than an hour from the quotient
 * and rounding lands on it exactly.
 */
export function daysBetween(fromMs: number, toMs: number): number {
    return Math.round((toMs - fromMs) / 86_400_000);
}

/** `n` calendar days on from a local midnight, through the local calendar. */
export function addLocalDays(ms: number, days: number): number {
    const date = new Date(ms);
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * `n` calendar months on, clamped to the destination month's last day.
 *
 * `setMonth` keeps the day of the month and rolls an impossible date forward —
 * 31 August plus six months lands on 3 March, which is the seventh month along
 * and not the one the offer said.
 */
export function addLocalMonths(ms: number, months: number): Date {
    const source = new Date(ms);
    const target = new Date(source.getFullYear(), source.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(source.getDate(), lastDay));
    return target;
}

/**
 * A local day as Material 3's date picker reads it. The picker shows the UTC
 * day of the instant it is given, so it is handed the local day's UTC midnight:
 * an evening entry west of Greenwich would otherwise open on the next day.
 */
export function utcPickerDay(date: Date): string {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}

/** The day a Material 3 picker reported (a UTC midnight), at `date`'s local time of day. */
export function onUtcPickerDay(picked: Date, date: Date): Date {
    const next = new Date(date);
    next.setFullYear(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate());
    return next;
}
