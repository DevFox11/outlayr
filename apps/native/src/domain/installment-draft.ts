import { decimalsFor } from "@outlayr/money/currency";
import { utcDateString } from "@outlayr/money/dates";
import { computeAmountUSD } from "@outlayr/money/rates";
import type { EntryRateType } from "@outlayr/money/rates";
import { convertFromUsd } from "@outlayr/money/round";

import { generateSchedule } from "./installments";
import type { InstallmentInterval, ScheduledInstallment } from "./installments";

/** The rhythms the entry form offers, each named for the providers that use it. */
export const EVERY_OPTIONS = {
    days14: { every: 14, kind: "days" },
    days15: { every: 15, kind: "days" },
    firstAndSixteenth: { days: [1, 16], kind: "semimonthly" },
    fifteenthAndLast: { days: [15, "last"], kind: "semimonthly" },
    monthly: { every: 1, kind: "months" },
    weekly: { every: 7, kind: "days" },
} as const satisfies Record<string, InstallmentInterval>;

export type EveryOption = keyof typeof EVERY_OPTIONS;

/** The order the picker lists them in, most common first. */
export const EVERY_ORDER = [
    "days14",
    "days15",
    "firstAndSixteenth",
    "fifteenthAndLast",
    "monthly",
    "weekly",
] as const satisfies readonly EveryOption[];

/** The upfront shortcuts, as a share of the price: Cashea's levels. */
export const UPFRONT_SHARES = [0.6, 0.5, 0.4] as const;

/**
 * What the entry form's Installments sheet holds. A share keeps the upfront
 * following the price as it is typed; a typed amount stays put.
 */
export interface InstallmentDraft {
    count: number;
    /** Null while each installment is the price left after the upfront, split over `count`. */
    each: number | null;
    /** One cuota's date or amount changed by hand, by sequence. Cleared when the schedule is rescheduled. */
    edits: Readonly<Record<number, { amount?: number; dueDate?: Date }>>;
    every: EveryOption;
    /** Null while it is one interval after the purchase. */
    firstDue: Date | null;
    /** Cuotas 1..k paid before Outlayr; null while it is the ones already due. */
    paidBefore: number | null;
    upfront: { amount: number } | { share: number };
    /** Where the upfront was paid from, or null when it was paid outside Outlayr. */
    upfrontAccountId: string | null;
}

export const DEFAULT_INSTALLMENT_COUNT = 3;

export function newInstallmentDraft(upfrontAccountId: string | null): InstallmentDraft {
    return {
        count: DEFAULT_INSTALLMENT_COUNT,
        each: null,
        edits: {},
        every: "days14",
        firstDue: null,
        paidBefore: null,
        upfront: { share: UPFRONT_SHARES[0] },
        upfrontAccountId,
    };
}

function roundTo(amount: number, currency: string): number {
    const scale = 10 ** decimalsFor(currency);
    return Math.round(amount * scale) / scale;
}

/**
 * The purchase price in the plan's currency, or null while a rate is missing.
 * The purchase keeps its own currency and is valued the way the account's
 * balance values it: its dollars at the rate the entry books with
 * (`entryRate`), then the plan currency's official per-USD rate for the day
 * (`planPerUsd`), so a paid-off order leaves the balance at zero.
 */
export function planPrice(
    purchase: { amount: number; currency: string; date: Date; rateType: EntryRateType },
    planCurrency: string,
    { entryRate, planPerUsd }: { entryRate: number | null; planPerUsd: number | null }
): number | null {
    if (purchase.currency === planCurrency) {
        return purchase.amount;
    }
    let usd: number | null = purchase.amount;
    if (purchase.currency !== "USD") {
        usd =
            entryRate === null || !(entryRate > 0)
                ? null
                : computeAmountUSD({
                      baseAmount: purchase.amount,
                      date: utcDateString(purchase.date.getTime()),
                      exchangeRate: entryRate,
                      exchangeRateType: purchase.rateType,
                  });
    }
    if (usd === null) {
        return null;
    }
    if (planCurrency === "USD") {
        return roundTo(usd, planCurrency);
    }
    return planPerUsd === null || !(planPerUsd > 0) ? null : convertFromUsd(usd, planPerUsd, planCurrency);
}

/** The upfront in the plan's currency, for a price. */
export function upfrontOf(draft: InstallmentDraft, price: number, currency: string): number {
    return "share" in draft.upfront ? roundTo(price * draft.upfront.share, currency) : draft.upfront.amount;
}

/**
 * The rows the draft makes for a purchase, or null while it cannot make any:
 * nothing left to split after the upfront, or an installment that is not positive.
 */
export function draftSchedule(
    draft: InstallmentDraft,
    price: number,
    purchaseDay: Date,
    currency: string
): ScheduledInstallment[] | null {
    const upfront = upfrontOf(draft, price, currency);
    const total = roundTo(price - upfront, currency);
    if (draft.each === null ? !(total > 0) : !(draft.each > 0)) {
        return null;
    }
    return generateSchedule({
        amount: draft.each === null ? { total } : { each: draft.each },
        count: draft.count,
        currency,
        firstDue: draft.firstDue ?? undefined,
        interval: EVERY_OPTIONS[draft.every],
        purchaseDay,
        upfront,
    }).map((row) => ({ ...row, ...draft.edits[row.sequence] }));
}

/** The draft with a new count, rhythm, first date or amount. Hand edits and checks start over. */
export function rescheduled(draft: InstallmentDraft, change: Partial<InstallmentDraft>): InstallmentDraft {
    return { ...draft, ...change, edits: {}, paidBefore: null };
}

/**
 * How many cuotas were paid before Outlayr: the count picked, or the leading
 * ones already due before `today`. Payments apply oldest first, so it is
 * always cuotas 1..k.
 */
export function paidBeforeCount(
    draft: InstallmentDraft,
    schedule: readonly ScheduledInstallment[],
    today: Date
): number {
    const cuotas = schedule.filter((row) => row.sequence > 0);
    if (draft.paidBefore !== null) {
        return Math.min(draft.paidBefore, cuotas.length);
    }
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const firstNotDue = cuotas.findIndex((row) => row.dueDate.getTime() >= startOfToday);
    return firstNotDue === -1 ? cuotas.length : firstNotDue;
}

/** What the schedule adds up to beyond the price, or 0. */
export function overPrice(schedule: readonly ScheduledInstallment[], price: number, currency: string): number {
    return Math.max(0, roundTo(schedule.reduce((sum, row) => sum + row.amount, 0) - price, currency));
}
