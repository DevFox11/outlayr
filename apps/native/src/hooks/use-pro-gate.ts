import { isPerson } from "@outlayr/money/account-kind";
import { useRouter } from "expo-router";

import { useDatabase } from "@/contexts/local-data-context";
import { useBankAccounts, usePeople } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { livePayoffPlanCount } from "@/data/payoff-plans";
import { isInstallmentAppAccount } from "@/domain/institution-map";
import { blocksNewCurrency, FREE_PAYOFF_PLANS, FREE_PEOPLE, fullAccountCaps } from "@/domain/pro-limits";
import { useProLocked } from "@/hooks/use-pro-locked";

export function useProCapped(count: number, limit: number): boolean {
    return useProLocked() && count >= limit;
}

/** Which free account caps are full: banks, cards and loans on one, curated installment apps on the other. */
export function useAccountCaps(): ReturnType<typeof fullAccountCaps> {
    return fullAccountCaps(useBankAccounts(useDatabase()), useProLocked());
}

type Named = Pick<Account, "kind" | "name">;

/**
 * Whether saving `account` lands in a full cap: a new one (`before` null), or an
 * edit that moves it between plain accounts and installment apps, as renaming
 * "Cashea" to "Visa" does. An edit that stays put is never capped.
 */
export function fillsFullCap(caps: ReturnType<typeof fullAccountCaps>, account: Named, before: Named | null): boolean {
    const app = isInstallmentAppAccount(account);
    return (before === null || isInstallmentAppAccount(before) !== app) && caps[app ? "installmentApps" : "accounts"];
}

/** {@link fillsFullCap} on this ledger's caps, for the account editor's save. */
export function useAccountSaveCapped(): (account: Named, before: Named | null) => boolean {
    const caps = useAccountCaps();
    return (account, before) => fillsFullCap(caps, account, before);
}

export function useAccountCreateRoute(): "/accounts/create" | "/paywall" {
    return useAccountCaps().accounts ? "/paywall" : "/accounts/create";
}

/** Where a new liability opens: it may yet be named after an installment app, which the editor caps once it is. */
export function useLiabilityCreateRoute(): "/accounts/create" | "/paywall" {
    const caps = useAccountCaps();
    return caps.accounts && caps.installmentApps ? "/paywall" : "/accounts/create";
}

/** True when a free ledger already holds {@link FREE_PEOPLE}, so adding one goes to the paywall. */
export function usePeopleCapped(): boolean {
    return useProCapped(usePeople(useDatabase()).length, FREE_PEOPLE);
}

type Priced = Pick<Account, "currency" | "kind" | "name">;

/**
 * Whether saving `account` brings a second currency onto a free ledger. Keeping
 * the currency a capped account already holds never does, even on a ledger over
 * the cap from an earlier Pro run, or a name or balance edit would be gated on a
 * currency nobody touched. An installment app or a person held no capped
 * currency, so renaming one into a plain account claims it like creating it would.
 */
export function blocksSavedCurrency(
    account: Priced,
    before: Priced | null,
    others: readonly Priced[],
    locked: boolean
): boolean {
    const kept =
        before !== null &&
        before.currency === account.currency &&
        !isPerson(before) &&
        !isInstallmentAppAccount(before);
    return !kept && blocksNewCurrency(account, others, locked);
}

/**
 * Runs `open`, or opens the paywall when a free ledger already holds
 * {@link FREE_PAYOFF_PLANS} live plans on accounts other than `accountId`, so
 * changing a plan is never capped. Counted when asked: only each account's
 * history says whether its plan has ended.
 */
export function usePayoffPlanGate(): (accountId: string | null, open: () => void) => void {
    const db = useDatabase();
    const router = useRouter();
    const locked = useProLocked();
    return (accountId, open) => {
        if (!locked) {
            open();
            return;
        }
        livePayoffPlanCount(db, accountId)
            .then((count) => (count >= FREE_PAYOFF_PLANS ? router.push("/paywall") : open()))
            // A count that failed is not a full cap.
            .catch(open);
    };
}

export function useCurrencyBlocked(exceptAccountId: string | null): (account: Priced) => boolean {
    const db = useDatabase();
    const accounts = useBankAccounts(db);
    const locked = useProLocked();
    return (account) =>
        blocksSavedCurrency(
            account,
            accounts.find((held) => held.id === exceptAccountId) ?? null,
            accounts.filter((held) => held.id !== exceptAccountId),
            locked
        );
}
