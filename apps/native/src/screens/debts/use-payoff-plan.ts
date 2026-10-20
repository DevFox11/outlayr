import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import type { AccountBalance } from "@outlayr/money/account-balance";
import { isPerson } from "@outlayr/money/account-kind";
import { useEffect, useRef, useState } from "react";

import type { Account } from "@/data/accounts-core";
import { setPayoffPlan, takesPayoffPlan } from "@/data/payoff-plans";
import type { PayoffLine } from "@/data/payoff-plans";
import { savingsGoalsRepo } from "@/data/savings-goals-core";
import type { Database } from "@/db/client";
import { usePayoffPlanGate } from "@/hooks/use-pro-gate";
import { useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";
import type { GoalCommit, GoalTarget } from "@/screens/budgets/components/goal-target-sheet";

function statedKey(account: Account, balance: number) {
    if (!isPerson(account)) {
        return "debts.plan.stated.liability";
    }
    return balance > 0 ? "debts.plan.stated.owesYou" : "debts.plan.stated.youOwe";
}

/**
 * Setting, changing and removing `account`'s payoff plan from its detail: what
 * the menu offers, `open` for the menu and the line, and the props of the goal
 * sheet that does it. Setting a new plan goes through the free cap first.
 */
export function usePayoffPlan(db: Database, account: Account, balance: AccountBalance, line: PayoffLine | null) {
    const t = useTranslation();
    const haptics = useHaptics();
    const gate = usePayoffPlanGate();
    const ref = useRef<BottomSheetModal>(null);
    const [target, setTarget] = useState<GoalTarget | null>(null);
    const live = line !== null && line.endedOn === null ? line : null;

    // Presented from an effect, as the goal screens do: a handler reaching for the
    // ref would read it in render as far as the compiler can tell.
    useEffect(() => {
        if (target) {
            ref.current?.present();
        }
    }, [target]);

    const present = () =>
        setTarget({
            accountId: account.id,
            balance: balance.exact ? balance.total : null,
            currency: account.currency,
            existing: live && { targetAmount: 0, targetDate: live.targetDate },
            name: account.name,
            payoff: t(statedKey(account, balance.total)),
        });

    const onCommit = async ({ dateChanged, targetDate }: GoalCommit) => {
        ref.current?.dismiss();
        if (!dateChanged) {
            return;
        }
        try {
            await setPayoffPlan(db, account, targetDate);
            haptics("success");
        } catch (error) {
            console.error("Failed to save the payoff plan", error);
            notifyFailure({ title: t("debts.plan.failed") });
        }
    };

    const remove = () => {
        ref.current?.dismiss();
        if (live) {
            savingsGoalsRepo.remove(db, live.goalId).catch(() => notifyFailure({ title: t("debts.plan.failed") }));
        }
    };

    return {
        /** No live plan, and a balance in the debt direction. */
        canSet: live === null && takesPayoffPlan(account, balance.total),
        live: live !== null,
        open: () => (live ? present() : gate(account.id, present)),
        remove,
        sheet: { onCommit, onRemove: live ? remove : undefined, ref, target },
    };
}

export type PayoffPlanControls = ReturnType<typeof usePayoffPlan>;
