import { useDatabase } from "@/contexts/local-data-context";
import { useBankAccounts, usePeople } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { blocksNewCurrency, FREE_PEOPLE, fullAccountCaps } from "@/domain/pro-limits";
import { useProLocked } from "@/hooks/use-pro-locked";

export function useProCapped(count: number, limit: number): boolean {
    return useProLocked() && count >= limit;
}

/** Which free account caps are full: banks, cards and loans on one, curated installment apps on the other. */
export function useAccountCaps(): ReturnType<typeof fullAccountCaps> {
    return fullAccountCaps(useBankAccounts(useDatabase()), useProLocked());
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

export function useCurrencyBlocked(
    exceptAccountId: string | null
): (account: Pick<Account, "currency" | "kind" | "name">) => boolean {
    const db = useDatabase();
    const accounts = useBankAccounts(db);
    const locked = useProLocked();
    return (account) => {
        // Keeping what the account already holds is never a new currency, even on
        // a ledger already over the cap from an earlier Pro run — otherwise a
        // name or balance edit would be gated on a currency nobody touched.
        if (accounts.find((held) => held.id === exceptAccountId)?.currency === account.currency) {
            return false;
        }
        return blocksNewCurrency(
            account,
            accounts.filter((held) => held.id !== exceptAccountId),
            locked
        );
    };
}
