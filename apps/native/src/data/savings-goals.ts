import { utcDateString } from "@outlayr/money/dates";
import { useMemo } from "react";

import type { Database } from "@/db/client";
import { savingsGoals, transactions, transfers } from "@/db/schema";
import { accountBalance } from "@/domain/account-balance";
import type { CurrencyCell } from "@/domain/currency-totals";
import { goalProgress } from "@/domain/savings-goal";
import type { GoalProgress } from "@/domain/savings-goal";
import { convertUsdSum } from "@/domain/valuation";

import { useAccounts } from "./accounts";
import { accountsCellQuery, toCurrencyCell } from "./cell-query";
import { useLiveQuery } from "./live-query";
import type { SavingsGoal } from "./savings-goals-core";
import { savingsGoalsQuery } from "./savings-goals-core";
import { toTransferCell, transfersInboundQuery, transfersOutboundQuery } from "./transfer-cells";
import { useValuation } from "./use-valuation";

export interface SavingsGoalWithProgress {
    goal: SavingsGoal;
    progress: GoalProgress;
    /** The account's balance, valued into the display currency. */
    saved: number;
    /** The target, valued into the display currency. */
    target: number;
}

/**
 * Every goal with the balance behind it, valued into the ledger's display
 * currency so a goal set in one currency and an account held in another still
 * compare. The target converts through its own frozen `targetAmountUsd`, the
 * same contract every other cross-currency figure keeps.
 */
export function useSavingsGoals(db: Database): SavingsGoalWithProgress[] {
    const goals = useLiveQuery(savingsGoals, () => savingsGoalsQuery(db));
    const accounts = useAccounts(db);
    const cellRows = useLiveQuery(transactions, () => accountsCellQuery(db));
    const outbound = useLiveQuery(transfers, () => transfersOutboundQuery(db));
    const inbound = useLiveQuery(transfers, () => transfersInboundQuery(db));
    const { displayCurrency, rates } = useValuation(db);

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

        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const now = new Date();

        return goals.flatMap((goal) => {
            const account = accountById.get(goal.accountId);
            if (account == null) {
                return [];
            }
            const opening =
                account.currency === displayCurrency || account.initialBalance === 0
                    ? account.initialBalance
                    : ((account.initialBalanceUsd == null
                          ? null
                          : convertUsdSum(
                                account.initialBalanceUsd,
                                utcDateString(account.initialBalanceDate.getTime()),
                                displayCurrency,
                                rates
                            )) ?? account.initialBalance);
            const flow = accountBalance(
                { currency: displayCurrency, initialBalance: 0 },
                byAccount.get(account.id) ?? [],
                rates
            );
            const saved = opening + flow.total;
            const target = targetInDisplay(goal, displayCurrency, rates);
            return [
                {
                    goal,
                    progress: goalProgress(saved, target, { now, targetDate: goal.targetDate }),
                    saved,
                    target,
                },
            ];
        });
    }, [goals, accounts, cellRows, outbound, inbound, displayCurrency, rates]);
}

function targetInDisplay(
    goal: SavingsGoal,
    displayCurrency: string,
    rates: Parameters<typeof convertUsdSum>[3]
): number {
    if (goal.currency === displayCurrency || goal.targetAmountUsd == null) {
        return goal.targetAmount;
    }
    const converted = convertUsdSum(
        goal.targetAmountUsd,
        utcDateString(goal.dateCreated.getTime()),
        displayCurrency,
        rates
    );
    return converted ?? goal.targetAmount;
}
