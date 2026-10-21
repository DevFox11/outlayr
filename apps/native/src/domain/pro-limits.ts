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

/**
 * Whether saving `account` lands in a full cap: a new one (`before` null), or an
 * edit that moves it between plain accounts and installment apps, as renaming
 * "Cashea" to "Visa" does. An edit that stays put is never capped.
 */
export function fillsFullCap(
    caps: ReturnType<typeof fullAccountCaps>,
    account: Omit<CappedAccount, "currency">,
    before: Omit<CappedAccount, "currency"> | null
): boolean {
    const app = isInstallmentAppAccount(account);
    return (before === null || isInstallmentAppAccount(before) !== app) && caps[app ? "installmentApps" : "accounts"];
}

/**
 * Whether saving `account` brings a second currency onto a free ledger. Keeping
 * the currency a capped account already holds never does, even on a ledger over
 * the cap from an earlier Pro run, or a name or balance edit would be gated on a
 * currency nobody touched. An installment app or a person held no capped
 * currency, so renaming one into a plain account claims it like creating it would.
 */
export function blocksSavedCurrency(
    account: CappedAccount,
    before: CappedAccount | null,
    others: readonly CappedAccount[],
    locked: boolean
): boolean {
    const kept =
        before !== null &&
        before.currency === account.currency &&
        !isPerson(before) &&
        !isInstallmentAppAccount(before);
    return !kept && blocksNewCurrency(account, others, locked);
}
