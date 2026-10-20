import { isPerson } from "@outlayr/money/account-kind";

import { isInstallmentAppAccount } from "./institution-map";

export const FREE_ACCOUNTS = 2;
export const FREE_BUDGETS = 2;
export const FREE_CURRENCIES = 1;
/** People sit outside every other cap: they never count as accounts, installment apps or currencies. */
export const FREE_PEOPLE = 3;
/**
 * Curated installment apps (Cashea, Klarna) have their own cap: they never
 * count toward {@link FREE_ACCOUNTS}, nor claim or use up the free currency.
 * Cards and loans are plain accounts.
 */
export const FREE_INSTALLMENT_APPS = 2;
/** Live payoff plans: one paid off has ended and no longer counts. */
export const FREE_PAYOFF_PLANS = 2;

/** What the account caps read off an account: its name and kind tell an installment app. */
interface CappedAccount {
    readonly currency: string;
    readonly kind: string;
    readonly name: string;
}

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

/** Which of a free ledger's account caps are full. `accounts` holds no people. */
export function fullAccountCaps(accounts: readonly Omit<CappedAccount, "currency">[], locked: boolean) {
    const apps = accounts.filter(isInstallmentAppAccount).length;
    return {
        accounts: locked && accounts.length - apps >= FREE_ACCOUNTS,
        installmentApps: locked && apps >= FREE_INSTALLMENT_APPS,
    };
}

/** People and curated installment apps hold any currency on a free ledger, and never claim one. */
const uncapped = (account: CappedAccount) => isPerson(account) || isInstallmentAppAccount(account);

/** Whether `account`'s currency is a second one on a free ledger. */
export function blocksNewCurrency(account: CappedAccount, others: readonly CappedAccount[], locked: boolean): boolean {
    if (!locked || uncapped(account)) {
        return false;
    }
    const distinct = new Set(others.filter((other) => !uncapped(other)).map((other) => other.currency));
    return distinct.size >= FREE_CURRENCIES && !distinct.has(account.currency);
}
