import { contributesTo } from "@outlayr/money/budget-spent";
import type { ExpenseContribution } from "@outlayr/money/budget-spent";
import type { BudgetWindow } from "@outlayr/money/budget-window";

import type { TranslateFn } from "@/i18n/context";

import { median } from "./stats";

interface DayBlock {
    amount: number;
    /** True once this purchase is the one that carries the day past the limit. */
    over: boolean;
    /** Spend accumulated before this purchase — the block's left edge, in currency. */
    start: number;
}

type DayVerdict = "room" | "tight" | "over" | null;

export interface DaySlots {
    /** Today's purchases in order, left to right. */
    blocks: DayBlock[];
    /** The dashed slot's amount, or null when one more wouldn't fit. */
    ghost: number | null;
    limit: number;
    /** Median purchase in this category across all history, or null with none. */
    median: number | null;
    /** Purchases that landed past the limit. */
    overflow: number;
    /** `limit - spent`; negative once blown. */
    remaining: number;
    /** How many median-sized purchases still fit under the limit. */
    roomFor: number;
    /** Currency the bar spans end to end, so the rule and any overflow both fit. */
    scale: number;
    spent: number;
    verdict: DayVerdict;
}

export interface DaySlotsOptions {
    /** Scope to one category and its subcategories; omit for the overall budget. */
    categoryId?: string | null;
    limit: number;
    now: Date;
    window: BudgetWindow;
}

/**
 * Taken over everything the expense list holds, not just the window. Null means
 * no history, and the caller must not guess a slot.
 */
export function categoryMedian(rows: readonly ExpenseContribution[], categoryId: string | null = null): number | null {
    const amounts: number[] = [];
    for (const row of rows) {
        if (row.amount > 0 && contributesTo(row, categoryId)) {
            amounts.push(row.amount);
        }
    }
    return median(amounts);
}

/**
 * A daily budget as discrete purchases rather than a curve: one block per
 * transaction sized by its amount, a dashed slot for the next typical one if it
 * fits, and the limit as a rule the blocks can run past.
 */
export function buildDaySlots(rows: readonly ExpenseContribution[], options: DaySlotsOptions): DaySlots {
    const { limit, window, now, categoryId = null } = options;
    const startMs = window.start.getTime();
    const endMs = window.end.getTime();
    const nowMs = now.getTime();

    const inWindow = rows
        .filter((row) => {
            if (row.amount <= 0 || !contributesTo(row, categoryId)) {
                return false;
            }
            const at = row.date.getTime();
            return at >= startMs && at < endMs && at <= nowMs;
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const blocks: DayBlock[] = [];
    let spent = 0;
    let overflow = 0;
    for (const row of inWindow) {
        const start = spent;
        spent += row.amount;
        const over = spent > limit;
        if (over) {
            overflow += 1;
        }
        blocks.push({ amount: row.amount, over, start });
    }

    const typicalAmount = categoryMedian(rows, categoryId);
    const remaining = limit - spent;
    const roomFor =
        typicalAmount != null && typicalAmount > 0 && remaining > 0 ? Math.floor(remaining / typicalAmount) : 0;
    const ghost = roomFor >= 1 ? typicalAmount : null;

    let verdict: DayVerdict = null;
    if (spent > limit) {
        verdict = "over";
    } else if (roomFor >= 1) {
        verdict = "room";
    } else if (typicalAmount != null) {
        verdict = "tight";
    }

    return {
        blocks,
        ghost,
        limit,
        median: typicalAmount,
        overflow,
        remaining,
        roomFor,
        scale: Math.max(limit, spent + (ghost ?? 0)),
        spent,
        verdict,
    };
}

/**
 * `noun` is what the overflow counts — the category on a per-category budget,
 * "purchase" for the overall one.
 */
export function dayVerdictSentence(slots: DaySlots, noun: string, t: TranslateFn): string | null {
    switch (slots.verdict) {
        case "room": {
            return t("daySlots.room");
        }
        case "tight": {
            return t("daySlots.tight");
        }
        case "over": {
            return t("daySlots.over", { count: slots.overflow, noun });
        }
        default: {
            return null;
        }
    }
}
