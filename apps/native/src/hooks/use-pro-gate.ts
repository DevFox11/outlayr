import { useRouter } from "expo-router";

import { useDatabase } from "@/contexts/local-data-context";
import { useBankAccounts, usePeople } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { livePayoffPlanCount } from "@/data/payoff-plans";
import {
    blocksSavedCurrency,
    FREE_PAYOFF_PLANS,
    FREE_PEOPLE,
    fillsFullCap,
    fullAccountCaps,
} from "@/domain/pro-limits";
import { useProLocked } from "@/hooks/use-pro-locked";

export function useProCapped(count: number, limit: number): boolean {
    return useProLocked() && count >= limit;
}

/** Which free account caps are full: banks, cards and loans on one, curated installment apps on the other. */
export function useAccountCaps(): ReturnType<typeof fullAccountCaps> {
    return fullAccountCaps(useBankAccounts(useDatabase()), useProLocked());
}

type Named = Pick<Account, "kind" | "name">;

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
