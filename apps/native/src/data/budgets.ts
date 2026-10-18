import { effectiveLimit, rolloverCarryFrom } from "@outlayr/money/budget-rollover";
import { spentForCategory, spentForMain } from "@outlayr/money/budget-spent";
import type { ExpenseContribution } from "@outlayr/money/budget-spent";
import {
    advanceBudgetWindow,
    BUDGET_TYPE,
    periodEnd,
    periodsBackTo,
    shiftWindow,
    startOfPeriod,
    windowEndMs,
} from "@outlayr/money/budget-window";
import type { BudgetWindow } from "@outlayr/money/budget-window";
import { limitIn, sumValuedIn, valueDatedRowsIn } from "@outlayr/money/valuation";
import { and, asc, desc, eq, getTableColumns, gte, inArray, isNull, lte } from "drizzle-orm";
import { useEffect, useMemo } from "react";

import { useSettingNumber } from "@/contexts/display-settings-context";
import type { Database } from "@/db/client";
import { budgets, mainBudget, transactions } from "@/db/schema";
import { buildBurndown } from "@/domain/budget-burndown";
import type { Burndown } from "@/domain/budget-burndown";
import { closedWindowsBefore, EVERY_SCOPE, spendPerWindow, typicalOf } from "@/domain/budget-typical";
import { translateNow } from "@/i18n/runtime";

import { expenseContributionQuery } from "./budget-spent";
import { budgetsRepo } from "./budgets-core";
import { useCategoryMeta } from "./categories";
import { useLiveQuery } from "./live-query";
import { useDecoratedRows } from "./transactions";
import type { TransactionWithCategory } from "./transactions";
import { useValuation } from "./use-valuation";

export { type BudgetSeverity, compareBudgetSeverity } from "@/domain/budget-severity";
export * from "./budgets-core";

export type Budget = typeof budgets.$inferSelect;

export interface CategoryBudgetView {
    /** The target this window actually runs on: `limit` plus any carry, floored at zero. */
    amount: number;
    /** Where the budget counts from. The editor writes this, and windows advance from it. */
    anchor: Date;
    /** Signed: unspent allowance inherited, or an overspend still being paid off. */
    carry: number;
    categoryId: string | null;
    color: string;
    /** The stored currency, which is not today's when the ledger's has since changed. */
    currency: string | null;
    /** The name as stored: null means the category's own name is standing in. */
    customName: string | null;
    /** Storage is icon XOR emoji, so a category with an emoji has no icon. */
    emoji: string | null;
    icon: string | null;
    id: string;
    leftover: number;
    /** The target as set, before anything carried into it. */
    limit: number;
    name: string;
    overBudget: boolean;
    rollover: boolean;
    spent: number;
    type: number;
    window: BudgetWindow;
}

export interface MainBudgetView {
    /** The target this window runs on: `limit` plus any carry, floored at zero. */
    amount: number;
    /** Where the budget counts from. The editor writes this, and windows advance from it. */
    anchor: Date;
    /** Signed: unspent allowance inherited, or an overspend still being paid off. */
    carry: number;
    /** The stored currency, which is not today's when the ledger's has since changed. */
    currency: string | null;
    /** The name as stored: null means the standing-in label is what is on screen. */
    customName: string | null;
    id: string;
    leftover: number;
    /** The target as set, before anything carried into it. */
    limit: number;
    name: string;
    overBudget: boolean;
    /** Whole closed periods behind the current window that hold spending. */
    periodsBack: number;
    rollover: boolean;
    spent: number;
    type: number;
    window: BudgetWindow;
}

/** The first day the ledger holds anything, or null while it holds nothing. */
export function earliestDate(rows: readonly { date: Date }[]): Date | null {
    let earliest: Date | null = null;
    for (const row of rows) {
        if (earliest === null || row.date.getTime() < earliest.getTime()) {
            earliest = row.date;
        }
    }
    return earliest;
}

/**
 * `useLiveQuery` registers a fresh database listener per call, so this list is a
 *parameter* to the budget hooks rather than something each one fetches. Call
 * it once per screen and thread the result down, or a single insert re-runs the
 * same full scan N times.
 */
export function useExpenseContributions(db: Database, nowMs: number): ExpenseContribution[] {
    const data = useLiveQuery(transactions, () => expenseContributionQuery(db, new Date(nowMs)), [nowMs]);

    const categoryMeta = useCategoryMeta(db);
    const valuation = useValuation(db);

    return useMemo(() => {
        const valued = valueDatedRowsIn(data, valuation.displayCurrency, valuation.rates);
        return data.map((row, index) => ({
            // `amount` is the valued amount from here down, not the row's stored one.
            amount: valued[index],
            categoryId: row.categoryId,
            date: row.date,
            parentId: row.categoryId ? (categoryMeta.get(row.categoryId)?.parentId ?? null) : null,
        }));
    }, [data, categoryMeta, valuation]);
}

/**
 * Null means no budget is set, never "not read yet": the read runs in render.
 * Rolls the persisted window forward on access.
 *
 * A negative `periodOffset` reports a closed window instead of the current one.
 * Only the current window is ever written back — browsing must not move the
 * anchor the budget is actually running on.
 */

export function useMainBudget(
    db: Database,
    nowMs: number,
    contributions: readonly ExpenseContribution[],
    periodOffset = 0
): MainBudgetView | null {
    const data = useLiveQuery(mainBudget, () =>
        db.select().from(mainBudget).where(isNull(mainBudget.deletedAt)).limit(1)
    );
    const row = data[0] ?? null;
    const { displayCurrency, rates } = useValuation(db);

    useEffect(() => {
        if (!row?.startDate) {
            return;
        }
        const win = advanceBudgetWindow(row.startDate, row.type, new Date(nowMs));
        if (win.start.getTime() !== row.startDate.getTime()) {
            budgetsRepo.advanceMainStart(db, row.id, win.start);
        }
    }, [db, row, nowMs]);

    return useMemo(() => {
        if (!row) {
            return null;
        }
        const now = new Date(nowMs);
        const current = advanceBudgetWindow(row.startDate ?? now, row.type, now);
        const window = shiftWindow(current.start, row.type, periodOffset);
        const spent = spentForMain(contributions, window.start, new Date(windowEndMs(window, nowMs)));
        const limit = limitIn(row, window.start, displayCurrency, rates);
        // Anchored on the window being VIEWED, not on today's: stepping back to
        // March must show what March actually inherited, not what this month did.
        const carry = row.rollover
            ? rolloverCarryFrom(contributions, null, {
                  anchor: row.dateCreated ?? window.start,
                  current: window,
                  limit,
                  type: row.type,
              }).credit
            : 0;
        const amount = effectiveLimit(limit, carry);
        return {
            amount,
            anchor: row.startDate ?? window.start,
            carry,
            currency: row.currency,
            customName: row.name?.trim() ? row.name.trim() : null,
            id: row.id,
            leftover: amount - spent,
            limit,
            name: row.name?.trim() ? row.name.trim() : translateNow("budgets.scope.everything"),
            overBudget: spent > amount,
            periodsBack: periodsBackTo(current.start, row.type, earliestDate(contributions)),
            rollover: row.rollover,
            spent,
            type: row.type,
            window,
        };
    }, [row, contributions, nowMs, periodOffset, displayCurrency, rates]);
}

/** A null `categoryId` scopes the series to the overall budget. */
export function useBurndown(
    contributions: readonly ExpenseContribution[],
    nowMs: number,
    budget: { amount: number; window: BudgetWindow } | null,
    categoryId: string | null = null
): Burndown | null {
    return useMemo(() => {
        if (!budget) {
            return null;
        }
        return buildBurndown(contributions, {
            categoryId,
            limit: budget.amount,
            now: new Date(nowMs),
            window: budget.window,
        });
    }, [contributions, budget, nowMs, categoryId]);
}

export function useBurndowns(
    contributions: readonly ExpenseContribution[],
    nowMs: number,
    budgetList: readonly CategoryBudgetView[]
): Map<string, Burndown> {
    return useMemo(() => {
        const now = new Date(nowMs);
        const series = new Map<string, Burndown>();
        for (const budget of budgetList) {
            series.set(
                budget.id,
                buildBurndown(contributions, {
                    categoryId: budget.categoryId,
                    limit: budget.amount,
                    now,
                    window: budget.window,
                })
            );
        }
        return series;
    }, [contributions, budgetList, nowMs]);
}

/**
 * Rolls each persisted window forward on access. An empty list means the user
 * has no budgets — it is never "not read yet".
 */
export function usePerCategoryBudgets(
    db: Database,
    nowMs: number,
    contributions: readonly ExpenseContribution[]
): CategoryBudgetView[] {
    const rows = useLiveQuery(budgets, () =>
        db
            .select(getTableColumns(budgets))
            .from(budgets)
            .where(isNull(budgets.deletedAt))
            .orderBy(asc(budgets.dateCreated))
    );
    const categoryMeta = useCategoryMeta(db);
    const { displayCurrency, rates } = useValuation(db);

    useEffect(() => {
        const now = new Date(nowMs);
        for (const row of rows) {
            if (!row.startDate) {
                continue;
            }
            const win = advanceBudgetWindow(row.startDate, row.type, now);
            if (win.start.getTime() !== row.startDate.getTime()) {
                budgetsRepo.advanceBudgetStart(db, row.id, win.start);
            }
        }
    }, [db, rows, nowMs]);

    return useMemo(() => {
        const now = new Date(nowMs);
        return rows.map((row) => {
            const window = advanceBudgetWindow(row.startDate ?? now, row.type, now);
            const spent = row.categoryId ? spentForCategory(contributions, row.categoryId, window.start, now) : 0;
            const meta = row.categoryId ? categoryMeta.get(row.categoryId) : undefined;
            const limit = limitIn(row, window.start, displayCurrency, rates);
            // Every closed window since the anchor, but only when the budget asked
            // for it: the walk costs a spend pass over the ledger, and a budget that
            // does not roll over must not pay for one.
            const carry =
                row.rollover && row.categoryId
                    ? rolloverCarryFrom(contributions, row.categoryId, {
                          anchor: row.dateCreated ?? window.start,
                          current: window,
                          limit,
                          type: row.type,
                      }).credit
                    : 0;
            const amount = effectiveLimit(limit, carry);
            return {
                amount,
                anchor: row.startDate ?? window.start,
                carry,
                categoryId: row.categoryId,
                color: meta?.color ?? "#767676",
                currency: row.currency,
                customName: row.name?.trim() ? row.name.trim() : null,
                emoji: meta?.emoji ?? null,
                icon: meta?.icon ?? null,
                id: row.id,
                leftover: amount - spent,
                limit,
                name: row.name?.trim() ? row.name.trim() : (meta?.name ?? "Budget"),
                overBudget: spent > amount,
                rollover: row.rollover,
                spent,
                type: row.type,
                window,
            };
        });
    }, [rows, contributions, categoryMeta, nowMs, displayCurrency, rates]);
}

export function useOverBudgetCount(db: Database, nowMs: number): number {
    const contributions = useExpenseContributions(db, nowMs);
    const perCategory = usePerCategoryBudgets(db, nowMs, contributions);
    return perCategory.reduce((count, budget) => (budget.overBudget ? count + 1 : count), 0);
}

export interface CategoryBudgetDetail {
    /** `null` once the budget is gone. */
    budget: CategoryBudgetView | null;
    /**
     * The ledger the carry was summed from, handed back so the screen's limit
     * sheet can draw its curve without opening a second listener over the same
     * rows — see {@link useExpenseContributions}.
     */
    contributions: readonly ExpenseContribution[];
    /** Whole closed periods behind the current window that hold spending. */
    periodsBack: number;
    /** Newest first. */
    transactions: TransactionWithCategory[];
}

/**
 * A negative `periodOffset` reports a closed window instead of the current one.
 * Only the current window is ever written back — browsing must not move the
 * anchor the budget is actually running on.
 */
export function useCategoryBudget(db: Database, id: string, nowMs: number, periodOffset = 0): CategoryBudgetDetail {
    const data = useLiveQuery(
        budgets,
        () =>
            db
                .select(getTableColumns(budgets))
                .from(budgets)
                .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
                .limit(1),
        [id]
    );
    const row = data[0] ?? null;
    const categoryMeta = useCategoryMeta(db);
    const { displayCurrency, rates } = useValuation(db);

    const current = useMemo(() => {
        if (!row) {
            return null;
        }
        const now = new Date(nowMs);
        return advanceBudgetWindow(row.startDate ?? now, row.type, now);
    }, [row, nowMs]);

    const window = useMemo(
        () => (current && row ? shiftWindow(current.start, row.type, periodOffset) : null),
        [current, row, periodOffset]
    );

    useEffect(() => {
        if (!(row?.startDate && current)) {
            return;
        }
        if (current.start.getTime() !== row.startDate.getTime()) {
            budgetsRepo.advanceBudgetStart(db, row.id, current.start);
        }
    }, [db, row, current]);

    const windowTransactions = useBudgetContributions(
        db,
        row?.categoryId ?? null,
        window ? window.start : null,
        window ? windowEndMs(window, nowMs) : nowMs
    );

    const earliest = useEarliestContribution(db, row?.categoryId ?? null);
    // Only the carry needs history beyond this window, and only when the budget
    // rolls over. It is the same read the list uses, so the two screens cannot
    // disagree about what a window inherited — a list saying one figure and the
    // detail behind it saying another is worse than not carrying at all.
    const contributions = useExpenseContributions(db, nowMs);

    const budget = useMemo(() => {
        if (!(row && window)) {
            return null;
        }
        // This screen queries its own rows instead of sharing
        // `useExpenseContributions`, so the conversion has to happen here.
        const spent = sumValuedIn(windowTransactions, displayCurrency, rates);
        const meta = row.categoryId ? categoryMeta.get(row.categoryId) : undefined;
        const limit = limitIn(row, window.start, displayCurrency, rates);
        const carry =
            row.rollover && row.categoryId
                ? rolloverCarryFrom(contributions, row.categoryId, {
                      anchor: row.dateCreated ?? window.start,
                      current: window,
                      limit,
                      type: row.type,
                  }).credit
                : 0;
        const amount = effectiveLimit(limit, carry);
        return {
            amount,
            anchor: row.startDate ?? window.start,
            carry,
            categoryId: row.categoryId,
            color: meta?.color ?? "#767676",
            currency: row.currency,
            customName: row.name?.trim() ? row.name.trim() : null,
            emoji: meta?.emoji ?? null,
            icon: meta?.icon ?? null,
            id: row.id,
            leftover: amount - spent,
            limit,
            name: row.name?.trim() ? row.name.trim() : (meta?.name ?? "Budget"),
            overBudget: spent > amount,
            rollover: row.rollover,
            spent,
            type: row.type,
            window,
        };
    }, [row, window, windowTransactions, categoryMeta, displayCurrency, rates, contributions]);

    const periodsBack = current && row ? periodsBackTo(current.start, row.type, earliest) : 0;

    return { budget, contributions, periodsBack, transactions: windowTransactions };
}

/**
 * The oldest expense that could count toward `categoryId` — a null id meaning
 * every expense. Null when the ledger holds none.
 *
 * Ports the Swift stepper's `firstDate`: a sorted fetch's first row rather than
 * a `min()` aggregate, which comes back as a raw column value the driver does
 * not map to a Date.
 */
function useEarliestContribution(db: Database, categoryId: string | null): Date | null {
    const categoryMeta = useCategoryMeta(db);

    const contributingIds = useMemo(
        () => contributingCategoryIds(categoryId, categoryMeta),
        [categoryId, categoryMeta]
    );
    const contributingKey = contributingIds?.join(",") ?? "";

    const rows = useLiveQuery(
        transactions,
        () =>
            db
                .select({ date: transactions.date })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.income, false),
                        isNull(transactions.deletedAt),
                        contributingIds ? inArray(transactions.categoryId, contributingIds) : undefined
                    )
                )
                .orderBy(asc(transactions.date))
                .limit(1),
        [contributingKey]
    );

    return rows[0]?.date ?? null;
}

/** Null means "every category" — the overall budget's scope. */
function contributingCategoryIds(
    categoryId: string | null,
    categoryMeta: ReadonlyMap<string, { parentId: string | null }>
): string[] | null {
    if (!categoryId) {
        return null;
    }
    const ids = [categoryId];
    for (const [id, meta] of categoryMeta) {
        if (meta.parentId === categoryId) {
            ids.push(id);
        }
    }
    return ids;
}

/**
 * Newest first. `categoryId === null` means the overall budget (every expense);
 * returns [] until `start` is known. `endMs` is the last instant that counts —
 * now for a running window, the window's own last instant for a closed one.
 *
 * The category relationship is resolved through {@link useCategoryMeta} rather
 * than a join: expressing "this category or its children" as
 * `eq(categories.parentId, …)` inside the join makes the *row set* depend on a
 * table the subscription does not watch, so re-parenting a subcategory silently
 * adds or drops its transactions until some transaction happens to be written.
 * Resolving the id set in JS and matching with `inArray` keeps it reactive.
 */
export function useBudgetContributions(
    db: Database,
    categoryId: string | null,
    start: Date | null,
    endMs: number
): TransactionWithCategory[] {
    // A null start (budget not loaded yet) must match nothing, not everything.
    const startMs = start ? start.getTime() : endMs + 1;
    const categoryMeta = useCategoryMeta(db);

    const contributingIds = useMemo(
        () => contributingCategoryIds(categoryId, categoryMeta),
        [categoryId, categoryMeta]
    );

    // A primitive so the subscription re-runs when the contributing set changes
    // without re-subscribing on every render's fresh array identity.
    const contributingKey = contributingIds?.join(",") ?? "";

    const data = useLiveQuery(
        transactions,
        () =>
            db
                .select(getTableColumns(transactions))
                .from(transactions)
                .where(
                    and(
                        eq(transactions.income, false),
                        isNull(transactions.deletedAt),
                        gte(transactions.date, new Date(startMs)),
                        lte(transactions.date, new Date(endMs)),
                        contributingIds ? inArray(transactions.categoryId, contributingIds) : undefined
                    )
                )
                .orderBy(desc(transactions.date), asc(transactions.feeForId)),
        [contributingKey, startMs, endMs]
    );

    return useDecoratedRows(db, data);
}

export interface UnbudgetedScope {
    categoryId: string;
    color: string;
    emoji: string | null;
    icon: string | null;
    name: string;
    /** Median spend per closed window. Only scopes that have one are listed. */
    typical: number;
}

export interface UnbudgetedRail {
    /** Median spend for the whole ledger, for the Everything row. */
    everything: number | null;
    /** Ordered by what they cost, heaviest first. */
    scopes: UnbudgetedScope[];
    /** The window a limit set from the rail would run on. */
    window: BudgetWindow;
}

/**
 * What you spend on and have not budgeted.
 *
 * Top-level categories only: a subcategory's spend already counts toward its
 * parent, so offering both would ask for the same money twice. A category with
 * nothing spent in the sampled windows is never listed — the rail is ordered by
 * cost, and a row with no figure has nothing to sort on. Reach those through the
 * picker instead.
 */
export function useUnbudgetedScopes(
    db: Database,
    nowMs: number,
    contributions: readonly ExpenseContribution[]
): UnbudgetedRail {
    const rows = useLiveQuery(budgets, () =>
        db.select({ categoryId: budgets.categoryId }).from(budgets).where(isNull(budgets.deletedAt))
    );
    const categoryMeta = useCategoryMeta(db);
    const firstDayOfMonth = useSettingNumber("firstDayOfMonth");
    const firstWeekday = useSettingNumber("firstWeekday");

    return useMemo(() => {
        const now = new Date(nowMs);
        const start = startOfPeriod(now, BUDGET_TYPE.month, { firstDayOfMonth, firstWeekday });
        const window = { end: periodEnd(start, BUDGET_TYPE.month), start };
        const totals = spendPerWindow(
            contributions,
            closedWindowsBefore({ current: window, since: earliestDate(contributions), type: BUDGET_TYPE.month })
        );
        const budgeted = new Set(rows.map((row) => row.categoryId));

        const scopes: UnbudgetedScope[] = [];
        for (const [categoryId, meta] of categoryMeta) {
            if (meta.parentId || budgeted.has(categoryId)) {
                continue;
            }
            const typical = typicalOf(totals.get(categoryId) ?? []);
            if (typical === null) {
                continue;
            }
            scopes.push({
                categoryId,
                color: meta.color ?? "#767676",
                emoji: meta.emoji,
                icon: meta.icon,
                name: meta.name ?? translateNow("budgets.name.default"),
                typical,
            });
        }
        scopes.sort((left, right) => right.typical - left.typical);

        return { everything: typicalOf(totals.get(EVERY_SCOPE) ?? []), scopes, window };
    }, [rows, categoryMeta, contributions, nowMs, firstDayOfMonth, firstWeekday]);
}
