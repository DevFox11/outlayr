import { isPerson, toAccountKind } from "@outlayr/money/account-kind";
import type { OverviewRow } from "@outlayr/money/account-overview";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { debtsOverview } from "@/domain/debts";
import type { DebtsOverview } from "@/domain/debts";

import { useAccounts, useOverviewOf } from "./accounts";
import type { Account } from "./accounts-core";
import { useValuation } from "./use-valuation";

export type DebtsScreenOverview = DebtsOverview<OverviewRow & { account: Account }>;

/**
 * Every liability account and every person, valued into the ledger's display
 * currency and split the way the Debts screen reads them. Each row carries its
 * account, so the screen needs no second lookup for a name or a logo.
 */
export function useDebtsOverview(db: Database, nowMs: number): DebtsScreenOverview {
    const all = useAccounts(db);
    const debts = useMemo(
        () => all.filter((account) => isPerson(account) || toAccountKind(account.kind) === "liability"),
        [all]
    );
    const valuation = useValuation(db);
    const overview = useOverviewOf(db, debts, valuation, nowMs);
    return useMemo(() => {
        const byId = new Map(debts.map((account) => [account.id, account]));
        const rows = (overview?.rows ?? []).flatMap((row) => {
            const account = byId.get(row.id);
            return account ? [{ ...row, account }] : [];
        });
        return debtsOverview(rows, valuation.displayCurrency);
    }, [debts, overview, valuation.displayCurrency]);
}
