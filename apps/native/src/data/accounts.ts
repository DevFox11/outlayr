import { isNull } from "drizzle-orm";
import { useMemo } from "react";
import type { Database } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { type AccountBalance, accountBalance } from "@/domain/account-balance";
import { type AccountsOverview, accountsOverview } from "@/domain/account-display";
import type { CurrencyCell } from "@/domain/currency-totals";
import type { Account } from "./accounts-core";
import { useCategoryMeta } from "./categories";
import { accountCellQuery, accountsCellQuery, toCurrencyCell } from "./cell-query";
import { useLiveQuery } from "./live-query";
import type { TransactionWithCategory } from "./transactions";
import { accountTransactionsQuery } from "./transactions-core";
import { useValuation, useValuationIn } from "./use-valuation";
import type { Valuation } from "./valuation-source";

/** Live accounts in manual order, tombstones excluded. */
export function useAccounts(db: Database): Account[] {
	return useLiveQuery(accounts, () =>
		db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(accounts.sortOrder)
	) as Account[];
}

function useAccountCells(db: Database, accountId: string): CurrencyCell[] {
	const rows = useLiveQuery(transactions, () => accountCellQuery(db, accountId), [accountId]);
	return useMemo(() => rows.map(toCurrencyCell), [rows]);
}

/**
 * The account's derived balance, valued into its own currency. Rates are
 * loaded for that currency, so two rows in different currencies each carry
 * their own subscription.
 */
export function useAccountBalance(
	db: Database,
	account: Pick<Account, "id" | "currency" | "initialBalance">
): AccountBalance {
	const cells = useAccountCells(db, account.id);
	const { rates } = useValuationIn(db, account.currency);
	return useMemo(() => accountBalance(account, cells, rates), [account, cells, rates]);
}

/**
 * Total across every account valued into `valuation`'s display currency. Null
 * with no accounts, so the overview card can hide entirely.
 */
export function useAccountsOverviewIn(db: Database, valuation: Valuation): AccountsOverview | null {
	const rows = useAccounts(db);
	const cellRows = useLiveQuery(transactions, () => accountsCellQuery(db));
	const { displayCurrency, rates } = valuation;
	return useMemo(
		() =>
			accountsOverview(
				rows,
				cellRows.map((row) => ({
					...toCurrencyCell(row),
					accountId: row.accountId,
				})),
				displayCurrency,
				rates
			),
		[rows, cellRows, displayCurrency, rates]
	);
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
