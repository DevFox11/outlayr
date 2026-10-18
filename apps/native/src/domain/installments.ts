import { decimalsFor } from "@outlayr/money/currency";

import type { TranslateFn } from "@/i18n/context";

import { addLocalDays, addLocalMonths, startOfLocalDay } from "./local-day";

/** A fixed day of the month, or the month's last day whatever its length. */
export type MonthDay = number | "last";

/**
 * How far apart the installments fall.
 *
 * `days` and `months` are not the same thing at 30: every 30 days drifts across
 * the calendar, monthly keeps the day of the month. `semimonthly` is two fixed
 * days a month (1 and 16, 15 and the last day), which Spanish also calls
 * "quincenal", the same word as every 15 days.
 */
export type InstallmentInterval =
    | { kind: "days"; every: number }
    | { kind: "months"; every: number }
    | { kind: "semimonthly"; days: readonly [MonthDay, MonthDay] };

/** The installments as a fixed amount each, or as a total split between them. */
export type InstallmentAmount = { each: number } | { total: number };

/**
 * What an order's schedule is generated from. Not stored: once generated, the
 * rows are the truth and are edited one by one.
 */
export interface ScheduleTemplate {
    /** What the N installments come to, upfront excluded, or what each one is. */
    amount: InstallmentAmount;
    /** How many installments after the upfront. One is valid. */
    count: number;
    /** Decides the minor unit a total is split in. */
    currency: string;
    /** Defaults to the purchase day plus one interval. */
    firstDue?: Date;
    interval: InstallmentInterval;
    purchaseDay: Date;
    /** Paid at purchase, as row 0. Absent or zero means none. */
    upfront?: number;
}

export interface ScheduledInstallment {
    amount: number;
    /** A local midnight. */
    dueDate: Date;
    /** 0 is the upfront, 1..N the installments. */
    sequence: number;
}

function assertTemplate(template: ScheduleTemplate): void {
    if (!(Number.isInteger(template.count) && template.count >= 1)) {
        throw new Error("An order needs at least one installment");
    }
    const { interval } = template;
    if (interval.kind === "semimonthly") {
        if (!interval.days.every((day) => day === "last" || (Number.isInteger(day) && day >= 1 && day <= 31))) {
            throw new Error("A semimonthly day is 1 to 31 or the last day");
        }
    } else if (!(Number.isInteger(interval.every) && interval.every >= 1)) {
        throw new Error("An interval is a whole number of at least one");
    }
    const amount = "each" in template.amount ? template.amount.each : template.amount.total;
    if (!(amount > 0)) {
        throw new Error("Installments must be positive");
    }
    if ((template.upfront ?? 0) < 0) {
        throw new Error("The upfront payment cannot be negative");
    }
}

/** `day` in the given month, clamped to the month's real last day. */
function clampedDay(year: number, month: number, day: MonthDay): Date {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, day === "last" ? lastDay : Math.min(day, lastDay));
}

/** Both fixed days of a month, in order and without the duplicate a short month can make. */
function semimonthlySlots(year: number, month: number, days: readonly MonthDay[]): Date[] {
    const slots = days.map((day) => clampedDay(year, month, day)).sort((a, b) => a.getTime() - b.getTime());
    return slots.filter((slot, index) => index === 0 || slot.getTime() !== slots[index - 1]?.getTime());
}

/** The first fixed day strictly after `afterMs`. */
function nextSemimonthly(afterMs: number, days: readonly MonthDay[]): Date {
    const after = new Date(afterMs);
    for (let offset = 0; ; offset += 1) {
        const slot = semimonthlySlots(after.getFullYear(), after.getMonth() + offset, days).find(
            (candidate) => candidate.getTime() > afterMs
        );
        if (slot) {
            return slot;
        }
    }
}

/**
 * The due dates of installments 1..count. Without a first due date the first one
 * is the purchase day plus one interval. Monthly dates are each measured from
 * their anchor (the first due date, else the purchase day) rather than from the
 * one before, so a month clamped to its 28th does not drag every later month
 * back to the 28th.
 */
function dueDates(
    purchaseMs: number,
    firstDue: Date | undefined,
    count: number,
    interval: InstallmentInterval
): Date[] {
    const indexes = Array.from({ length: count }, (_, index) => index);
    switch (interval.kind) {
        case "days": {
            const firstMs = firstDue?.getTime() ?? addLocalDays(purchaseMs, interval.every);
            return indexes.map((index) => new Date(addLocalDays(firstMs, index * interval.every)));
        }
        case "months": {
            return firstDue === undefined
                ? indexes.map((index) => addLocalMonths(purchaseMs, (index + 1) * interval.every))
                : indexes.map((index) => addLocalMonths(firstDue.getTime(), index * interval.every));
        }
        case "semimonthly": {
            let due = firstDue ?? nextSemimonthly(purchaseMs, interval.days);
            const dates = [due];
            while (dates.length < count) {
                due = nextSemimonthly(due.getTime(), interval.days);
                dates.push(due);
            }
            return dates;
        }
        default: {
            throw new Error("Unknown installment interval");
        }
    }
}

/**
 * Whole minor units of `currency`. Every figure in this module is summed and
 * compared in these, so a plan of 3 x 13.33 + 13.34 never drifts by a float.
 */
function toMinor(amount: number, currency: string): number {
    return Math.round(amount * 10 ** decimalsFor(currency));
}

function fromMinor(minor: number, currency: string): number {
    return minor / 10 ** decimalsFor(currency);
}

/**
 * Splits a total into `count` parts in whole minor units, the remainder in the
 * LAST part: the one rule a provider documents (Afterpay Pay Monthly).
 */
export function splitTotal(total: number, count: number, currency: string): number[] {
    const totalMinor = toMinor(total, currency);
    const base = Math.floor(totalMinor / count);
    return Array.from({ length: count }, (_, index) =>
        fromMinor(index === count - 1 ? totalMinor - base * (count - 1) : base, currency)
    );
}

/**
 * Generates an order's rows: the upfront as sequence 0 on the purchase day when
 * there is one, then the installments. The total may differ from the purchase
 * price (fees, interest, rounding), and nothing here asks it not to.
 */
export function generateSchedule(template: ScheduleTemplate): ScheduledInstallment[] {
    assertTemplate(template);
    const { amount, count, currency, interval } = template;
    const purchaseMs = startOfLocalDay(template.purchaseDay.getTime());
    const firstDue =
        template.firstDue === undefined ? undefined : new Date(startOfLocalDay(template.firstDue.getTime()));
    const amounts =
        "each" in amount
            ? Array.from({ length: count }, () => fromMinor(toMinor(amount.each, currency), currency))
            : splitTotal(amount.total, count, currency);

    const upfront = fromMinor(toMinor(template.upfront ?? 0, currency), currency);
    const rows = dueDates(purchaseMs, firstDue, count, interval).map((dueDate, index) => ({
        amount: amounts[index] ?? 0,
        dueDate,
        sequence: index + 1,
    }));
    return upfront > 0 ? [{ amount: upfront, dueDate: new Date(purchaseMs), sequence: 0 }, ...rows] : rows;
}

/** The columns status is derived from. */
export interface InstallmentLike {
    amount: number;
    dueDate: Date;
    sequence: number;
}

export interface InstallmentStanding<Row extends InstallmentLike> {
    /** How much of this row the plan's payments reach, in the plan's currency. */
    covered: number;
    /** Not fully covered and due before the given day. */
    overdue: boolean;
    remaining: number;
    row: Row;
    status: "paid" | "partial" | "unpaid";
}

export interface PlanStanding<Row extends InstallmentLike> {
    finished: boolean;
    /** Installments 1..N fully covered, for "3 of 6 paid". The upfront is not one. */
    installmentsPaid: number;
    installmentsTotal: number;
    /** The first row not fully covered. */
    next: InstallmentStanding<Row> | null;
    /** Payments beyond the schedule's total. */
    overpaid: number;
    paid: number;
    remaining: number;
    /** Oldest first, by due date then sequence. */
    rows: InstallmentStanding<Row>[];
    scheduled: number;
}

/**
 * What a plan's payments cover. Nothing is marked paid per row: the total paid
 * (the `toAmount` of every live transfer pointing at the plan plus its outside
 * payments, all in the plan's currency) is allocated oldest first. That one rule covers partial,
 * early and over-payments with no extra state.
 */
export function planStanding<Row extends InstallmentLike>(
    rows: readonly Row[],
    paid: number,
    today: Date,
    currency: string
): PlanStanding<Row> {
    const todayMs = startOfLocalDay(today.getTime());
    const ordered = [...rows].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.sequence - b.sequence);
    const paidMinor = toMinor(paid, currency);
    let left = paidMinor;
    let scheduledMinor = 0;

    const standings = ordered.map((row): InstallmentStanding<Row> => {
        const amountMinor = toMinor(row.amount, currency);
        scheduledMinor += amountMinor;
        const coveredMinor = Math.min(Math.max(left, 0), amountMinor);
        left -= coveredMinor;
        const remainingMinor = amountMinor - coveredMinor;
        let status: InstallmentStanding<Row>["status"] = "partial";
        if (remainingMinor === 0) {
            status = "paid";
        } else if (coveredMinor === 0) {
            status = "unpaid";
        }
        return {
            covered: fromMinor(coveredMinor, currency),
            overdue: remainingMinor > 0 && row.dueDate.getTime() < todayMs,
            remaining: fromMinor(remainingMinor, currency),
            row,
            status,
        };
    });

    const installments = standings.filter((standing) => standing.row.sequence > 0);
    return {
        finished: standings.every((standing) => standing.status === "paid"),
        installmentsPaid: installments.filter((standing) => standing.status === "paid").length,
        installmentsTotal: installments.length,
        next: standings.find((standing) => standing.status !== "paid") ?? null,
        overpaid: fromMinor(Math.max(paidMinor - scheduledMinor, 0), currency),
        paid: fromMinor(paidMinor, currency),
        remaining: fromMinor(Math.max(scheduledMinor - paidMinor, 0), currency),
        rows: standings,
        scheduled: fromMinor(scheduledMinor, currency),
    };
}

/** What an order is called: its purchase's merchant, else plain "Order". */
export function orderName(t: TranslateFn, purchase: { note: string } | null): string {
    return purchase?.note.trim() || t("installments.order");
}
