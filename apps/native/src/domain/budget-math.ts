import { BUDGET_TYPE } from "@outlayr/money/budget-window";
import type { BudgetWindow } from "@outlayr/money/budget-window";
import { addDays, startOfDay } from "@outlayr/money/calendar";

import type { TranslationKey } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";

import { monthAbbrev } from "./dates";
import { daysBetween } from "./local-day";

function dayMonth(date: Date, language: Language): string {
    return `${date.getDate()} ${monthAbbrev(date, language)}`;
}

function twoDigitYear(date: Date): string {
    return String(date.getFullYear() % 100).padStart(2, "0");
}

/** Ports the Swift stepper's `dateString`. Ends are exclusive; the label is not. */
export function budgetWindowLabel(window: BudgetWindow, type: number, language: Language = runtimeLanguage()): string {
    if (type === BUDGET_TYPE.day) {
        return `${dayMonth(window.start, language)} ${window.start.getFullYear()}`;
    }
    const last = addDays(window.end, -1);
    if (type === BUDGET_TYPE.year) {
        return `${dayMonth(window.start, language)} ${twoDigitYear(window.start)} – ${dayMonth(last, language)} ${twoDigitYear(last)}`;
    }
    return `${dayMonth(window.start, language)} – ${dayMonth(last, language)}`;
}

/**
 * The catalog key for the span a budget covers, not the phrase — the widget
 * payload wants it shouted and the app wants it in a sentence, so casing is the
 * caller's to decide.
 */
export function budgetPeriodPhrase(type: number): TranslationKey {
    switch (type) {
        case BUDGET_TYPE.day: {
            return "budgets.period.day";
        }
        case BUDGET_TYPE.week: {
            return "budgets.period.week";
        }
        case BUDGET_TYPE.month: {
            return "budgets.period.month";
        }
        case BUDGET_TYPE.year: {
            return "budgets.period.year";
        }
        default: {
            return "budgets.period.other";
        }
    }
}

/**
 * The cadence as a chip's label, title-cased. `budgetPeriodPhrase` is the same
 * span as a phrase inside a sentence; a chip is neither, so the two are separate
 * keys rather than one string cased at the call site — the first locale where
 * case carries meaning would break that.
 */
export function budgetPeriodName(type: number): TranslationKey {
    switch (type) {
        case BUDGET_TYPE.day: {
            return "budgets.periodName.day";
        }
        case BUDGET_TYPE.week: {
            return "budgets.periodName.week";
        }
        case BUDGET_TYPE.year: {
            return "budgets.periodName.year";
        }
        default: {
            return "budgets.periodName.month";
        }
    }
}

/** The cadence mid-sentence: "a month", "al mes". */
export function budgetPeriodCadence(type: number): TranslationKey {
    switch (type) {
        case BUDGET_TYPE.day: {
            return "budgets.periodPhrase.day";
        }
        case BUDGET_TYPE.week: {
            return "budgets.periodPhrase.week";
        }
        case BUDGET_TYPE.year: {
            return "budgets.periodPhrase.year";
        }
        default: {
            return "budgets.periodPhrase.month";
        }
    }
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function clamp01(value: number): number {
    if (Number.isNaN(value)) {
        return 0;
    }
    return Math.max(0, Math.min(1, value));
}

export interface BudgetPace {
    /** Continuous fraction of the window already elapsed, clamped [0, 1]. */
    elapsed: number;
    /**
     * Fraction of the window's time still remaining, on whole-day granularity —
     * the Swift `targetPercent`.
     */
    remaining: number;
}

/**
 * `remaining` mirrors the Swift `targetPercent = (totalDays - (daysPast + 1)) /
 * totalDays`, counting the current day as consumed so the marker leads spending.
 */
export function budgetPace(window: BudgetWindow, now: Date): BudgetPace {
    const totalMs = window.end.getTime() - window.start.getTime();
    const elapsedMs = now.getTime() - window.start.getTime();
    if (totalMs <= 0) {
        return { elapsed: 1, remaining: 0 };
    }
    const totalDays = Math.max(1, Math.round(totalMs / DAY_MS));
    const daysPast = Math.max(0, daysBetween(window.start.getTime(), startOfDay(now).getTime())) + 1;
    return {
        elapsed: clamp01(elapsedMs / totalMs),
        remaining: clamp01((totalDays - daysPast) / totalDays),
    };
}

/**
 * Whole days remaining in the window, counted from today's own midnight.
 *
 * Counted forward to the end rather than backward from a total: flooring raw
 * milliseconds since the window opened reads an hour short for the whole of the
 * first local day after a clock shift, so on the last day of a month containing
 * one the label said two days left.
 */
export function daysLeftInWindow(window: BudgetWindow, now: Date): number {
    return Math.max(0, daysBetween(startOfDay(now).getTime(), window.end.getTime()));
}

/** Whole hours remaining in a daily window, rounded up so the last part-hour still counts as one. */
export function hoursLeftInDay(window: BudgetWindow, now: Date): number {
    return Math.max(0, Math.ceil((window.end.getTime() - now.getTime()) / HOUR_MS));
}

export function budgetTimeLeftLabel(window: BudgetWindow, type: number, now: Date, t: TranslateFn): string {
    if (type === BUDGET_TYPE.day) {
        return t("budgetTime.hoursLeft", { count: hoursLeftInDay(window, now) });
    }
    return t("budgetTime.daysLeft", { count: daysLeftInWindow(window, now) });
}

export function leftPerDay(leftover: number, window: BudgetWindow, now: Date): number {
    return leftover / Math.max(1, daysLeftInWindow(window, now));
}

export function isBehindPace(remaining: number, amount: number, leftover: number): boolean {
    return remaining * amount > leftover;
}

/**
 * The 0.95 ceiling keeps the marker clear of the arc's ends (Swift's
 * `0 < targetPercent < 0.95`).
 */
export function shouldShowPaceMarker(type: number, remaining: number, over: boolean): boolean {
    return type !== BUDGET_TYPE.day && !over && remaining > 0 && remaining < 0.95;
}

export interface BudgetRail {
    /** Share of the track the solid fill covers, in [0, 1]. */
    fill: number;
    /** Spending passed the limit: the rail re-scales. */
    over: boolean;
}

/**
 * Over budget the track becomes the spending and the fill is the limit's share
 * of it, so a rail that would otherwise sit empty at every overage instead
 * reports how far past the limit the spending went.
 */
export function budgetRail(spent: number, limit: number): BudgetRail {
    const over = spent > limit;
    if (over) {
        return { fill: clampFill(limit / spent), over };
    }
    // A limit of zero has no track to fill, and would divide to NaN.
    return { fill: limit > 0 ? clampFill(1 - spent / limit) : 0, over };
}

function clampFill(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(1, value));
}

/** What a detail screen shows about pace, for the window it is looking at. */
export interface BudgetDetailPace {
    behind: boolean;
    closed: boolean;
    /** Null when the window is closed or already over, where a rate says nothing. */
    perDay: number | null;
    /** Null when no marker should be drawn. */
    paceRemaining: number | null;
}

/**
 * Both budget detail screens — the category one and the overall one — read this.
 *
 * They are separate screens because their data hooks and their toolbars differ,
 * but the pace they report must not: a marker shown on one and withheld on the
 * other is the same budget contradicting itself. Keeping the rule here is what
 * stops the two drifting, the way their editors once did.
 */
export function budgetDetailPace(
    budget: { amount: number; leftover: number; overBudget: boolean; type: number; window: BudgetWindow },
    now: Date,
    periodOffset: number
): BudgetDetailPace {
    const closed = periodOffset < 0;
    const pace = budgetPace(budget.window, now);
    const showMarker = !closed && shouldShowPaceMarker(budget.type, pace.remaining, budget.overBudget);
    return {
        behind: !closed && isBehindPace(pace.remaining, budget.amount, budget.leftover),
        closed,
        paceRemaining: showMarker ? pace.remaining : null,
        perDay: closed || budget.overBudget ? null : leftPerDay(budget.leftover, budget.window, now),
    };
}
