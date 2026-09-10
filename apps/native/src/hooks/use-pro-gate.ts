import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { blocksNewCurrency, FREE_ACCOUNTS } from "@/domain/pro-limits";
import { useProLocked } from "@/hooks/use-pro-locked";

export function useProCapped(count: number, limit: number): boolean {
    return useProLocked() && count >= limit;
}

export function useAccountCreateRoute(): "/accounts/create" | "/paywall" {
    const db = useDatabase();
    return useProCapped(useAccounts(db).length, FREE_ACCOUNTS) ? "/paywall" : "/accounts/create";
}

export function useCurrencyBlocked(exceptAccountId: string | null): (code: string) => boolean {
    const db = useDatabase();
    const accounts = useAccounts(db);
    const locked = useProLocked();
    return (code) => {
        // Keeping what the account already holds is never a new currency, even on
        // a ledger already over the cap from an earlier Pro run — otherwise a
        // name or balance edit would be gated on a currency nobody touched.
        if (accounts.find((account) => account.id === exceptAccountId)?.currency === code) {
            return false;
        }
        return blocksNewCurrency(
            code,
            accounts.filter((account) => account.id !== exceptAccountId).map((account) => account.currency),
            locked
        );
    };
}
