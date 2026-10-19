import { isPerson, toAccountKind } from "@outlayr/money/account-kind";
import { summarizeOverview } from "@outlayr/money/account-overview";
import type { AccountsOverview, OverviewRow } from "@outlayr/money/account-overview";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { debtsOverview } from "@/domain/debts";
import type { DebtsOverview } from "@/domain/debts";

import { useAccounts, useOverviewOf } from "./accounts";
import type { Account } from "./accounts-core";
import { useGlobalCurrency } from "./app-meta";
import { dueWindow, installmentsByAccount } from "./debts-due";
import type { AccountInstallments, DueWindow } from "./debts-due";
import { useInstallmentPlans } from "./installments";
import type { PlanWithStanding } from "./installments-core";
import type { Valuation } from "./valuation-source";

export type DebtsScreenOverview = DebtsOverview<OverviewRow & { account: Account }> & {
    /** The cuotas due in the next 14 days and the overdue ones; null when there are none. */
    due: DueWindow | null;
    /** Each liability's open orders and soonest unpaid cuota, by account id. */
    installments: ReadonlyMap<string, AccountInstallments>;
};

/**
 * `overview`'s liabilities and people, each with its account, split the way the
 * Debts screen reads them, with the cuotas of the orders on those accounts.
 * `valuation.rates` has to carry every account's currency beside the display one.
 */
function debtsIn(
    accounts: readonly Account[],
    overview: AccountsOverview | null,
    plans: readonly PlanWithStanding[],
    valuation: Valuation,
    nowMs: number
): DebtsScreenOverview {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const rows = (overview?.rows ?? []).flatMap((row) => {
        const account = byId.get(row.id);
        return account ? [{ ...row, account }] : [];
    });
    const listed = plans.filter(({ plan }) => byId.has(plan.accountId));
    return {
        ...debtsOverview(rows, valuation.displayCurrency),
        due: dueWindow(listed, nowMs, valuation.displayCurrency, valuation.rates),
        installments: installmentsByAccount(listed),
    };
}

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
    const displayCurrency = useGlobalCurrency(db);
    const { overview, rates } = useOverviewOf(db, debts, displayCurrency, nowMs);
    const plans = useInstallmentPlans(db, nowMs);
    return useMemo(
        () => debtsIn(debts, overview, plans, { displayCurrency, rates }, nowMs),
        [debts, overview, plans, displayCurrency, rates, nowMs]
    );
}

export interface LogOverview {
    /** The bank accounts the Log's block draws; people are left to Debts. */
    banks: AccountsOverview | null;
    debts: DebtsScreenOverview;
}

/**
 * Every account valued once into `valuation`'s currency, split into the Log's
 * bank block and its Debts row, so both follow the Log's currency and a write
 * re-values the ledger once. `excludeId` drops an account whose deletion is
 * pending its undo window: its cells are ignored with it, so the total moves as
 * the row leaves rather than after the write lands.
 */
export function useLogOverviewIn(
    db: Database,
    valuation: Valuation,
    nowMs: number,
    excludeId: string | null = null
): LogOverview {
    const all = useAccounts(db);
    const rows = useMemo(
        () => (excludeId == null ? all : all.filter((account) => account.id !== excludeId)),
        [all, excludeId]
    );
    const { displayCurrency } = valuation;
    const { overview, rates } = useOverviewOf(db, rows, displayCurrency, nowMs);
    const plans = useInstallmentPlans(db, nowMs);
    return useMemo(
        () => ({
            banks: summarizeOverview((overview?.rows ?? []).filter((row) => row.kind !== "person")),
            debts: debtsIn(rows, overview, plans, { displayCurrency, rates }, nowMs),
        }),
        [rows, overview, plans, displayCurrency, rates, nowMs]
    );
}
