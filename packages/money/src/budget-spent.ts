/**
 * A subcategory counts toward its parent's budget. A null `categoryId` is the
 * overall budget, which every expense feeds.
 */
export function contributesTo(row: ExpenseContribution, categoryId: string | null | undefined): boolean {
    if (categoryId == null) {
        return true;
    }
    return row.categoryId === categoryId || row.parentId === categoryId;
}

/**
 * The inclusive upper bound `spentForMain` and `spentForCategory` take, from
 * the exclusive end of a window. Both functions count a row dated exactly on
 * their upper bound, so handing one a window's own end counts a boundary-dated
 * transaction in that window AND in the next one.
 */
export function lastMsBefore(end: Date): Date {
    return new Date(end.getTime() - 1);
}

/**
 * Already filtered to non-deleted expenses dated on or before now, and carrying
 * its category's `parentId`.
 */
export interface ExpenseContribution {
    amount: number;
    categoryId: string | null;
    date: Date;
    parentId: string | null;
}

/**
 * Spend over `[start, now]`. Ports
 * `BudgetRepository.fetchRequestForBudgetTransactions`.
 */
export function spentForCategory(
    rows: readonly ExpenseContribution[],
    categoryId: string,
    start: Date,
    now: Date
): number {
    const startMs = start.getTime();
    const nowMs = now.getTime();
    let total = 0;
    for (const row of rows) {
        const t = row.date.getTime();
        if (t < startMs || t > nowMs) {
            continue;
        }
        if (contributesTo(row, categoryId)) {
            total += row.amount;
        }
    }
    return total;
}

/**
 * Every expense over `[start, now]`, whatever its category. Ports
 * `BudgetRepository.fetchRequestForMainBudgetTransactions`.
 */
export function spentForMain(rows: readonly ExpenseContribution[], start: Date, now: Date): number {
    const startMs = start.getTime();
    const nowMs = now.getTime();
    let total = 0;
    for (const row of rows) {
        const t = row.date.getTime();
        if (t >= startMs && t <= nowMs) {
            total += row.amount;
        }
    }
    return total;
}
