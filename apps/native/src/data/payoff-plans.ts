import { restate } from "@outlayr/money/account-overview";
import type { OverviewRow } from "@outlayr/money/account-overview";
import { utcDateString } from "@outlayr/money/dates";

import type { Database } from "@/db/client";
import { minorUnitsFor } from "@/domain/money";
import { goalProgress, isPayoffPlan } from "@/domain/savings-goal";

import { settledBalanceAt } from "./accounts";
import type { Account } from "./accounts-core";
import type { SavingsGoal } from "./savings-goals-core";
import { GoalValuationError, savingsGoalsRepo } from "./savings-goals-core";
import { loadValuationIn } from "./valuation-source";
import type { Valuation } from "./valuation-source";

/** What a Debts row needs to draw its payoff line. */
export interface PayoffLine {
    /**
     * 0 to 1 of the start balance paid off: the fill. Null while the balance or
     * the start cannot be valued: with no rate both read zero, which is not paid off.
     */
    fraction: number | null;
    /** The plan's goal, for `savingsGoalsRepo.update` and `remove`. */
    goalId: string;
    /** Back at zero or past it. False while `fraction` is null. */
    reached: boolean;
    targetDate: Date;
    /**
     * 0 to 1, where the date wants the fill today. Null once reached, while
     * `fraction` is, or when the plan was set on its own target date.
     */
    tick: number | null;
}

/**
 * Sets a payoff plan on a liability or a person: a goal with zero as its target,
 * anchored on the account's balance at this instant in its own currency, so the
 * share paid does not move with the rate. A change of date is
 * `savingsGoalsRepo.update`, removal is `savingsGoalsRepo.remove` or the "goal"
 * deferred delete. Throws {@link GoalValuationError} when the balance cannot be
 * valued, as a goal does.
 */
export async function createPayoffPlan(
    db: Database,
    account: Account,
    targetDate: Date,
    now: Date = new Date()
): Promise<string> {
    const balance = await settledBalanceAt(db, account, await loadValuationIn(db, account.currency), now);
    if (!balance.exact) {
        throw new GoalValuationError();
    }
    return await savingsGoalsRepo.create(db, {
        accountId: account.id,
        currency: account.currency,
        name: account.name,
        startAmount: balance.value,
        targetAmount: 0,
        targetDate,
    });
}

/**
 * Each row's payoff plan, by account id: the first live plan on it, in goal
 * order. `rows` are valued into `valuation`'s currency at today's rate, and the
 * start is restated at that same rate rather than read through its frozen USD
 * figure, so a debt in a currency that moved reads as paid only when it was.
 */
export function payoffLines(
    goals: readonly SavingsGoal[],
    rows: readonly OverviewRow[],
    { displayCurrency, rates }: Valuation,
    nowMs: number
): ReadonlyMap<string, PayoffLine> {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const today = utcDateString(nowMs);
    const now = new Date(nowMs);
    const lines = new Map<string, PayoffLine>();
    for (const goal of goals) {
        const row = byId.get(goal.accountId);
        if (row === undefined || !isPayoffPlan(goal) || lines.has(row.id)) {
            continue;
        }
        const start = restate(goal.startAmount, goal.currency, displayCurrency, today, rates);
        const progress = goalProgress(
            row.balance,
            0,
            { now, startAmount: start.value, startDate: goal.dateCreated, targetDate: goal.targetDate },
            minorUnitsFor(displayCurrency)
        );
        const valued = row.exact && start.exact;
        lines.set(row.id, {
            fraction: valued ? progress.fraction : null,
            goalId: goal.id,
            reached: valued && progress.reached,
            targetDate: goal.targetDate,
            tick: valued ? (progress.standing?.elapsed ?? null) : null,
        });
    }
    return lines;
}
