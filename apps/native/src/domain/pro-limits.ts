export const FREE_ACCOUNTS = 2;
export const FREE_BUDGETS = 2;
export const FREE_CURRENCIES = 1;

export function blocksNewBudget(
    categoryId: string | null,
    budgetedCategoryIds: readonly string[],
    capped: boolean
): boolean {
    if (categoryId === null || !capped) {
        return false;
    }
    return !budgetedCategoryIds.includes(categoryId);
}

export function blocksNewCurrency(code: string, otherCurrencies: readonly string[], locked: boolean): boolean {
    if (!locked) {
        return false;
    }
    const distinct = new Set(otherCurrencies);
    return distinct.size >= FREE_CURRENCIES && !distinct.has(code);
}
