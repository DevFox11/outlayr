import type { AccountBalanceInput } from "@outlayr/money/account-balance";
import { toAccountKind } from "@outlayr/money/account-kind";
import { restate } from "@outlayr/money/account-overview";
import type { OverviewRow } from "@outlayr/money/account-overview";
import { valueCell } from "@outlayr/money/currency-totals";
import { utcDateString } from "@outlayr/money/dates";
import type { RateTable } from "@outlayr/money/valuation";

import type { Database } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import type { PlottedCell } from "@/domain/goal-balance-series";
import { localDayKey } from "@/domain/local-day";
import { minorUnitsFor, roundToMinorUnits } from "@/domain/money";
import { goalProgress, isPayoffPlan } from "@/domain/savings-goal";
import type { GoalProgress } from "@/domain/savings-goal";

import { settledBalanceAt, settledCellsAt } from "./accounts";
import { accountsRepo } from "./accounts-core";
import type { Account } from "./accounts-core";
import type { SavingsGoal } from "./savings-goals-core";
import { GoalValuationError, savingsGoalsQuery, savingsGoalsRepo } from "./savings-goals-core";
import { loadValuationIn } from "./valuation-source";
import type { Valuation } from "./valuation-source";

/** What a Debts row and a detail need to draw a payoff plan. */
export interface PayoffLine {
    /** How far behind the line the date draws, stated positive; null when on pace or ahead. */
    behind: number | null;
    /**
     * The local `YYYY-MM-DD` the plan ended on, once the balance reached zero or
     * crossed it. An ended plan draws no line and asks for nothing.
     */
    endedOn: string | null;
    /**
     * 0 to 1 of the start balance paid off: the fill. Null while the balance or
     * the start cannot be valued: with no rate both read zero, which is not paid off.
     */
    fraction: number | null;
    /** The plan's goal, for `savingsGoalsRepo.update` and `remove`. */
    goalId: string;
    /** What a month costs until the date; null once reached or while unvalued. */
    pace: GoalProgress["pace"];
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
 * Whether a balance can take a payoff plan: a liability below zero, or a person
 * either side of it. A settled or overpaid balance has nothing to pay off.
 */
export function takesPayoffPlan(account: Pick<Account, "currency" | "kind">, balance: number): boolean {
    const rounded = roundToMinorUnits(balance, account.currency);
    const kind = toAccountKind(account.kind);
    return kind === "person" ? rounded !== 0 : kind === "liability" && rounded < 0;
}

/**
 * The local day a plan ended on: the first day since it was set that took the
 * account's balance to zero or past it, in the account's own currency. Null while
 * it has not. Cells hold a day's totals, not its order, so a day's payments are
 * counted before its new debt: paid off in the morning and used again by night
 * still ends the plan. The day it was set only counts how it closed, as its
 * payments may have come before the plan.
 *
 * Read from the history rather than written when it happens, so a plan paid off
 * while Debts was never opened still ends on the right day, and a card used again
 * later does not bring an ended plan back as behind.
 */
export function payoffEndedOn(
    plan: Pick<SavingsGoal, "dateCreated" | "startAmount">,
    account: AccountBalanceInput,
    cells: readonly PlottedCell[],
    rates: RateTable
): string | null {
    const since = localDayKey(plan.dateCreated.getTime());
    // The start's side is the debt's direction: owed climbs to zero, owed to you comes down to it.
    const direction = Math.sign(plan.startAmount);
    const byDay = new Map<string, { net: number; paid: number }>();
    for (const cell of cells) {
        const net = (cell.income ? 1 : -1) * valueCell(cell, account.currency, rates);
        const total = byDay.get(cell.plotDay) ?? { net: 0, paid: 0 };
        total.net += net;
        // A movement against the debt's side pays it down.
        total.paid += Math.sign(net) === -direction ? net : 0;
        byDay.set(cell.plotDay, total);
    }
    const reached = (balance: number) => direction * roundToMinorUnits(balance, account.currency) <= 0;
    let running = account.initialBalance;
    // `YYYY-MM-DD` keys sort lexically exactly as they sort chronologically.
    for (const [day, { net, paid }] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
        const lowest = running + paid;
        running += net;
        if (day > since ? reached(lowest) || reached(running) : day === since && reached(running)) {
            return day;
        }
    }
    return null;
}

/** `account`'s payoff plans, and the local day each ended on, read at `now`. */
async function plansOn(db: Database, account: Account, now: Date) {
    const [goals, cells, { rates }] = await Promise.all([
        savingsGoalsQuery(db),
        settledCellsAt(db, account.id, now),
        loadValuationIn(db, account.currency),
    ]);
    return goals
        .filter((goal) => goal.accountId === account.id && isPayoffPlan(goal))
        .map((goal) => ({ endedOn: payoffEndedOn(goal, account, cells, rates), goal }));
}

/**
 * Sets `account`'s payoff plan to end on `targetDate`. A live plan moves its
 * date and keeps its start. Otherwise a goal with zero as its target is
 * anchored on the balance at this instant in the account's own currency, so the
 * share paid does not move with the rate, and any ended plan on the account goes
 * in the same write: an account holds one plan at a time.
 *
 * Returns the plan's id, or null with nothing written when the balance is not a
 * debt ({@link takesPayoffPlan}). Removal is `savingsGoalsRepo.remove`. Throws
 * {@link GoalValuationError} when the balance cannot be valued, as a goal does.
 */
export async function setPayoffPlan(
    db: Database,
    account: Account,
    targetDate: Date,
    now: Date = new Date()
): Promise<string | null> {
    const plans = await plansOn(db, account, now);
    const live = plans.find((plan) => plan.endedOn === null);
    if (live !== undefined) {
        await savingsGoalsRepo.update(db, live.goal.id, { targetDate });
        return live.goal.id;
    }
    const balance = await settledBalanceAt(db, account, await loadValuationIn(db, account.currency), now);
    if (!balance.exact) {
        throw new GoalValuationError();
    }
    if (!takesPayoffPlan(account, balance.value)) {
        return null;
    }
    let id = "";
    await withTransaction(db, async () => {
        await Promise.all(plans.map(({ goal }) => savingsGoalsRepo.remove(db, goal.id, now)));
        id = await savingsGoalsRepo.create(db, {
            accountId: account.id,
            currency: account.currency,
            name: account.name,
            startAmount: balance.value,
            targetAmount: 0,
            targetDate,
        });
    });
    return id;
}

/**
 * How many payoff plans are live, set and not yet ended, on accounts other than
 * `exceptAccountId`: what the free cap counts. Read when asked rather than
 * subscribed to, since only each account's history says whether its plan ended.
 */
export async function livePayoffPlanCount(
    db: Database,
    exceptAccountId: string | null,
    now: Date = new Date()
): Promise<number> {
    const [goals, rows] = await Promise.all([savingsGoalsQuery(db), accountsRepo.listActive(db)]);
    const planned = new Set(
        goals.filter((goal) => isPayoffPlan(goal) && goal.accountId !== exceptAccountId).map((goal) => goal.accountId)
    );
    const live = await Promise.all(
        rows
            .filter((row) => planned.has(row.id))
            .map(async (row) => {
                const plans = await plansOn(db, row, now);
                return plans.filter((plan) => plan.endedOn === null).length;
            })
    );
    return live.reduce((sum, count) => sum + count, 0);
}

/**
 * Each row's payoff plan, by account id: the first live plan on it in goal
 * order, else the first ended one. `rows` are valued into `valuation`'s
 * currency at today's rate, and the start is restated at that same rate rather
 * than read through its frozen USD figure, so a debt in a currency that moved
 * reads as paid only when it was. `endings` holds each ended plan's day by goal id.
 */
export function payoffLines(
    goals: readonly SavingsGoal[],
    rows: readonly OverviewRow[],
    { displayCurrency, rates }: Valuation,
    nowMs: number,
    endings: ReadonlyMap<string, string> = new Map()
): ReadonlyMap<string, PayoffLine> {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const today = utcDateString(nowMs);
    const now = new Date(nowMs);
    const lines = new Map<string, PayoffLine>();
    for (const goal of goals) {
        const row = byId.get(goal.accountId);
        const endedOn = endings.get(goal.id) ?? null;
        const held = row && lines.get(row.id);
        if (row === undefined || !isPayoffPlan(goal) || (held && (held.endedOn === null || endedOn !== null))) {
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
        const standing = valued ? progress.standing : null;
        lines.set(row.id, {
            behind: standing && !standing.onPace && standing.against < 0 ? -standing.against : null,
            endedOn,
            fraction: valued ? progress.fraction : null,
            goalId: goal.id,
            pace: valued ? progress.pace : null,
            reached: valued && progress.reached,
            targetDate: goal.targetDate,
            tick: standing?.elapsed ?? null,
        });
    }
    return lines;
}
