import { isNull } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { accounts, transactions, transfers } from "@/db/schema";
import { accountBalance } from "@/domain/account-balance";
import type { AccountBalance } from "@/domain/account-balance";
import { accountsOverview } from "@/domain/account-display";
import type { AccountsOverview } from "@/domain/account-display";
import type { CurrencyCell } from "@/domain/currency-totals";
import { netWorthSeries } from "@/domain/net-worth-series";
import type { NetWorthSeriesPoint } from "@/domain/net-worth-series";
import type { RateTable } from "@/domain/valuation";

import type { Account } from "./accounts-core";
import { useCategoryMeta } from "./categories";
import { accountCellQuery, accountsCellQuery, toCurrencyCell } from "./cell-query";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";
import { accountTransactionsQuery } from "./transactions-core";
import {
    toTransferCell,
    transferInboundQuery,
    transferOutboundQuery,
    transfersInboundQuery,
    transfersOutboundQuery,
} from "./transfer-cells";
import { useValuation, useValuationIn } from "./use-valuation";
import type { Valuation } from "./valuation-source";

/** Live accounts in manual order, tombstones excluded. */
export function useAccounts(db: Database): Account[] {
    return useLiveQuery(accounts, () =>
        db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(accounts.sortOrder)
    ) as Account[];
}

export function useAccountCells(db: Database, accountId: string): CurrencyCell[] {
    const rows = useLiveQuery(transactions, () => accountCellQuery(db, accountId), [accountId]);
    const outbound = useLiveQuery(transfers, () => transferOutboundQuery(db, accountId), [accountId]);
    const inbound = useLiveQuery(transfers, () => transferInboundQuery(db, accountId), [accountId]);
    return useMemo(
        () => [
            ...rows.map(toCurrencyCell),
            ...outbound.map((row) => toTransferCell(row, false)),
            ...inbound.map((row) => toTransferCell(row, true)),
        ],
        [rows, outbound, inbound]
    );
}

/**
 * The account's derived balance, valued into its own currency. Rates are
 * loaded for that currency, so two rows in different currencies each carry
 * their own subscription.
 */
export function useAccountBalanceDetails(
    db: Database,
    account: Pick<Account, "id" | "currency" | "initialBalance">
): { balance: AccountBalance; cells: CurrencyCell[]; rates: RateTable } {
    const cells = useAccountCells(db, account.id);
    const { rates } = useValuationIn(db, account.currency);
    const balance = useMemo(() => accountBalance(account, cells, rates), [account, cells, rates]);
    return useMemo(() => ({ balance, cells, rates }), [balance, cells, rates]);
}

/** The account's derived balance, valued into its own currency. */
export function useAccountBalance(
    db: Database,
    account: Pick<Account, "id" | "currency" | "initialBalance">
): AccountBalance {
    return useAccountBalanceDetails(db, account).balance;
}

/**
 * Total across every account valued into `valuation`'s display currency. Null
 * with no accounts, so the overview card can hide entirely.
 */
export function useAccountsOverviewIn(db: Database, valuation: Valuation): AccountsOverview | null {
    const rows = useAccounts(db);
    const cellRows = useLiveQuery(transactions, () => accountsCellQuery(db));
    const outbound = useLiveQuery(transfers, () => transfersOutboundQuery(db));
    const inbound = useLiveQuery(transfers, () => transfersInboundQuery(db));
    const { displayCurrency, rates } = valuation;
    return useMemo(
        () =>
            accountsOverview(
                rows,
                [
                    ...cellRows.map((row) => ({
                        ...toCurrencyCell(row),
                        accountId: row.accountId,
                    })),
                    ...outbound.map(({ accountId, ...row }) => ({ ...toTransferCell(row, false), accountId })),
                    ...inbound.map(({ accountId, ...row }) => ({ ...toTransferCell(row, true), accountId })),
                ],
                displayCurrency,
                rates
            ),
        [rows, cellRows, outbound, inbound, displayCurrency, rates]
    );
}

/**
 * Net worth over the recent window, valued into `valuation`'s currency.
 *
 * Shares the cell set `useAccountsOverviewIn` reads, so the line's last point
 * and the accounts card agree by construction rather than by coincidence.
 */
export function useNetWorthSeriesIn(db: Database, valuation: Valuation): NetWorthSeriesPoint[] {
    const rows = useAccounts(db);
    const cellRows = useLiveQuery(transactions, () => accountsCellQuery(db));
    const outbound = useLiveQuery(transfers, () => transfersOutboundQuery(db));
    const inbound = useLiveQuery(transfers, () => transfersInboundQuery(db));
    const { displayCurrency, rates } = valuation;
    return useMemo(() => {
        const byAccount = new Map<string, CurrencyCell[]>();
        const push = (accountId: string | null, cell: CurrencyCell) => {
            if (accountId == null) {
                return;
            }
            const bucket = byAccount.get(accountId);
            if (bucket) {
                bucket.push(cell);
            } else {
                byAccount.set(accountId, [cell]);
            }
        };
        for (const row of cellRows) {
            push(row.accountId, toCurrencyCell(row));
        }
        for (const { accountId, ...row } of outbound) {
            push(accountId, toTransferCell(row, false));
        }
        for (const { accountId, ...row } of inbound) {
            push(accountId, toTransferCell(row, true));
        }
        return netWorthSeries(rows, byAccount, rates, new Date(), displayCurrency);
    }, [rows, cellRows, outbound, inbound, rates, displayCurrency]);
}

/** {@link useNetWorthSeriesIn} for the ledger's own display currency. */
export function useNetWorthSeries(db: Database): NetWorthSeriesPoint[] {
    return useNetWorthSeriesIn(db, useValuation(db));
}

/** {@link useAccountsOverviewIn} for the ledger's own display currency. */
export function useAccountsOverview(db: Database): AccountsOverview | null {
    return useAccountsOverviewIn(db, useValuation(db));
}

/**
 * The account's attached transactions, newest first and unbounded — a balance
 * counts everything the account ever saw, so its history shows the same set.
 */
export function useAccountTransactions(db: Database, accountId: string): TransactionWithCategory[] {
    const data = useLiveQuery(transactions, () => accountTransactionsQuery(db, accountId), [accountId]);
    const categoryMeta = useCategoryMeta(db);
    return useMemo(
        () =>
            data.map((row) => {
                const meta = row.categoryId ? categoryMeta.get(row.categoryId) : undefined;
                return {
                    ...row,
                    categoryColor: meta?.color ?? null,
                    categoryEmoji: meta?.emoji ?? null,
                    categoryIcon: meta?.icon ?? null,
                    categoryName: meta?.name ?? null,
                };
            }),
        [data, categoryMeta]
    );
}
