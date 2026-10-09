import { accountBalance } from "@outlayr/money/account-balance";
import type { AccountBalance } from "@outlayr/money/account-balance";
import { accountsOverview, initialInDisplay } from "@outlayr/money/account-overview";
import type { DisplayedBalance, AccountsOverview } from "@outlayr/money/account-overview";
import type { CurrencyCell } from "@outlayr/money/currency-totals";
import type { RateTable } from "@outlayr/money/valuation";
import { isNull } from "drizzle-orm";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { accounts, transactions, transfers } from "@/db/schema";
import type { PlottedCell } from "@/domain/goal-balance-series";
import { roundToMinorUnits } from "@/domain/money";
import { netWorthSeries } from "@/domain/net-worth-series";
import type { NetWorthSeriesPoint } from "@/domain/net-worth-series";

import type { Account } from "./accounts-core";
import { settledAccountCellQuery, settledAccountsCellQuery, toCurrencyCell } from "./cell-query";
import { useLiveQuery } from "./live-query";
import { useDecoratedRows } from "./transactions";
import type { TransactionWithCategory } from "./transactions";
import { accountTransactionsQuery } from "./transactions-core";
import {
    settledTransferInboundQuery,
    settledTransferOutboundQuery,
    settledTransfersInboundQuery,
    settledTransfersOutboundQuery,
    toTransferCell,
} from "./transfer-cells";
import { useValuation, useValuationIn } from "./use-valuation";
import { loadValuationIn } from "./valuation-source";
import type { Valuation } from "./valuation-source";

/** Live accounts in manual order, tombstones excluded. */
export function useAccounts(db: Database): Account[] {
    // SAFETY: drizzle types a select builder per column map; `useLiveQuery`
    // takes the erased one and the table argument pins the row type back.
    return useLiveQuery(accounts, () =>
        db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(accounts.sortOrder)
    ) as Account[];
}

export function useSettledAccountCells(db: Database, accountId: string, nowMs: number): PlottedCell[] {
    // Bounded in SQL for the reason `settledAccountsCellQuery` documents: a cell
    // keeps only a day key, so a row dated later today cannot be told from one
    // already made once it is grouped.
    const settledAt = useMemo(() => new Date(nowMs), [nowMs]);
    const rows = useLiveQuery(transactions, () => settledAccountCellQuery(db, accountId, settledAt), [
        accountId,
        settledAt,
    ]);
    const outbound = useLiveQuery(transfers, () => settledTransferOutboundQuery(db, accountId, settledAt), [
        accountId,
        settledAt,
    ]);
    const inbound = useLiveQuery(transfers, () => settledTransferInboundQuery(db, accountId, settledAt), [
        accountId,
        settledAt,
    ]);
    return useMemo(
        () => [
            // `plotDay` says where a row is DRAWN; `dateKey` stays the day it was
            // valued at, which is the date its rate is looked up under.
            ...rows.map(({ plotDay, ...row }) => ({ ...toCurrencyCell(row), plotDay })),
            ...outbound.map(({ plotDay, ...row }) => ({ ...toTransferCell(row, false), plotDay })),
            ...inbound.map(({ plotDay, ...row }) => ({ ...toTransferCell(row, true), plotDay })),
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
    account: Pick<Account, "id" | "currency" | "initialBalance">,
    nowMs: number
): { balance: AccountBalance; cells: CurrencyCell[]; rates: RateTable } {
    const cells = useSettledAccountCells(db, account.id, nowMs);
    const { rates } = useValuationIn(db, account.currency);
    const balance = useMemo(() => accountBalance(account, cells, rates), [account, cells, rates]);
    return useMemo(() => ({ balance, cells, rates }), [balance, cells, rates]);
}

/** The account's derived balance, valued into its own currency. */
export function useAccountBalance(
    db: Database,
    account: Pick<Account, "id" | "currency" | "initialBalance">,
    nowMs: number
): AccountBalance {
    return useAccountBalanceDetails(db, account, nowMs).balance;
}

/**
 * Every account valued into `valuation`'s currency, with the per-account rows
 * the Log draws. `excludeId` drops an account whose deletion is pending its
 * undo window: its cells are ignored with it, so the total moves as the row
 * leaves rather than after the write lands.
 */
export function useAccountsOverviewIn(
    db: Database,
    valuation: Valuation,
    nowMs: number,
    excludeId: string | null = null
): AccountsOverview | null {
    const all = useAccounts(db);
    const rows = useMemo(
        () => (excludeId == null ? all : all.filter((account) => account.id !== excludeId)),
        [all, excludeId]
    );
    const settledAt = useMemo(() => new Date(nowMs), [nowMs]);
    const cellRows = useLiveQuery(transactions, () => settledAccountsCellQuery(db, settledAt), [settledAt]);
    const outbound = useLiveQuery(transfers, () => settledTransfersOutboundQuery(db, settledAt), [settledAt]);
    const inbound = useLiveQuery(transfers, () => settledTransfersInboundQuery(db, settledAt), [settledAt]);
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
function useNetWorthSeriesIn(db: Database, valuation: Valuation, nowMs: number): NetWorthSeriesPoint[] {
    const rows = useAccounts(db);
    const settledAt = useMemo(() => new Date(nowMs), [nowMs]);
    const cellRows = useLiveQuery(transactions, () => settledAccountsCellQuery(db, settledAt), [settledAt]);
    const outbound = useLiveQuery(transfers, () => settledTransfersOutboundQuery(db, settledAt), [settledAt]);
    const inbound = useLiveQuery(transfers, () => settledTransfersInboundQuery(db, settledAt), [settledAt]);
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
        return netWorthSeries(rows, byAccount, rates, settledAt, displayCurrency);
    }, [rows, cellRows, outbound, inbound, rates, settledAt, displayCurrency]);
}

/** {@link useNetWorthSeriesIn} for the ledger's own display currency. */
export function useNetWorthSeries(db: Database, nowMs: number): NetWorthSeriesPoint[] {
    return useNetWorthSeriesIn(db, useValuation(db), nowMs);
}

export function useAccountTransactions(db: Database, accountId: string): TransactionWithCategory[] {
    const data = useLiveQuery(transactions, () => accountTransactionsQuery(db, accountId), [accountId]);
    return useDecoratedRows(db, data);
}

/**
 * Every account's balance valued into `valuation`'s display currency, by id.
 *
 * The overview sums the same walk into one figure; this keeps the per-account
 * rows, which is what a screen needs when it is about to freeze one of them —
 * a goal's starting line, for instance.
 */
function useAccountBalancesIn(db: Database, valuation: Valuation, nowMs: number): Map<string, DisplayedBalance> {
    const rows = useAccounts(db);
    // Bounded at `now` in SQL, not filtered afterwards: a cell carries only a day
    // key, so an entry scheduled for later today is indistinguishable from one
    // already made and would read as money already put aside.
    const settledAt = useMemo(() => new Date(nowMs), [nowMs]);
    const cellRows = useLiveQuery(transactions, () => settledAccountsCellQuery(db, settledAt), [settledAt]);
    const outbound = useLiveQuery(transfers, () => settledTransfersOutboundQuery(db, settledAt), [settledAt]);
    const inbound = useLiveQuery(transfers, () => settledTransfersInboundQuery(db, settledAt), [settledAt]);
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
        return new Map(
            rows.map((account) => {
                const opening = initialInDisplay(account, displayCurrency, rates);
                // Opening handled above, so the walk contributes flow only.
                const flow = accountBalance(
                    { currency: displayCurrency, initialBalance: 0 },
                    byAccount.get(account.id) ?? [],
                    rates
                );
                // Exactness travels with the figure rather than being dropped. A
                // caller that DISPLAYS an approximate balance can say so and correct
                // itself when the rates arrive; a caller that FREEZES one cannot, and
                // has to be able to refuse.
                return [account.id, { exact: opening.exact && flow.exact, value: opening.value + flow.total }];
            })
        );
    }, [rows, cellRows, outbound, inbound, displayCurrency, rates]);
}

/** {@link useAccountBalancesIn} for the ledger's own display currency. */
export function useAccountBalances(db: Database, nowMs: number): Map<string, DisplayedBalance> {
    return useAccountBalancesIn(db, useValuation(db), nowMs);
}

/**
 * One account's settled balance read at `now`, straight from the database.
 *
 * The hooks above are bounded by `useNow()`, which ticks at local midnight, on a
 * ledger write and on resume — so a row scheduled for 15:00 today is still
 * excluded at 15:01, because its arrival is not itself a write. That staleness
 * is harmless where a balance is merely displayed: it corrects itself at the
 * next tick, and the goal standing is measured in whole days anyway.
 *
 * It is not harmless where a balance is FROZEN. A goal's start anchor is written
 * once and read forever, so it has to be the balance at the instant it was
 * taken, not at the last time the app happened to look.
 */
export async function settledBalanceAt(
    db: Database,
    account: Account,
    valuation: Valuation,
    now: Date
): Promise<DisplayedBalance> {
    const [rows, outbound, inbound] = await Promise.all([
        settledAccountCellQuery(db, account.id, now),
        settledTransferOutboundQuery(db, account.id, now),
        settledTransferInboundQuery(db, account.id, now),
    ]);
    const cells = [
        ...rows.map(toCurrencyCell),
        ...outbound.map((row) => toTransferCell(row, false)),
        ...inbound.map((row) => toTransferCell(row, true)),
    ];
    const { displayCurrency, rates } = valuation;
    const opening = initialInDisplay(account, displayCurrency, rates);
    const flow = accountBalance({ currency: displayCurrency, initialBalance: 0 }, cells, rates);
    return { exact: opening.exact && flow.exact, value: opening.value + flow.total };
}

export async function openingForBalance(
    db: Database,
    accountId: string,
    balance: number,
    currency: string,
    now: Date
): Promise<number> {
    const [rows, outbound, inbound, { rates }] = await Promise.all([
        settledAccountCellQuery(db, accountId, now),
        settledTransferOutboundQuery(db, accountId, now),
        settledTransferInboundQuery(db, accountId, now),
        loadValuationIn(db, currency),
    ]);
    const cells = [
        ...rows.map(toCurrencyCell),
        ...outbound.map((row) => toTransferCell(row, false)),
        ...inbound.map((row) => toTransferCell(row, true)),
    ];
    const flow = accountBalance({ currency, initialBalance: 0 }, cells, rates).total;
    return roundToMinorUnits(balance - flow, currency);
}
