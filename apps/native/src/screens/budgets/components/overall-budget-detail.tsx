import { Color, Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { toolbarIcon } from "@/components/toolbar-icons";
import { useGlobalCurrency } from "@/data/app-meta";
import {
    budgetsRepo,
    useBudgetContributions,
    useExpenseContributions,
    useMainBudget,
    windowEndMs,
} from "@/data/budgets";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import {
    budgetPace,
    budgetPeriodPhrase,
    budgetWindowLabel,
    isBehindPace,
    leftPerDay,
    shouldShowPaceMarker,
} from "@/domain/budget-math";
import { useTranslation } from "@/i18n/context";
import { confirmDeleteBudget } from "@/lib/budget-actions";
import { BudgetDetailView } from "@/screens/budgets/components/budget-detail-view";
import { BudgetPeriodStepper } from "@/screens/budgets/components/budget-period-stepper";

/**
 * Lives under `/budgets/[id]` with the reserved id `overall` rather than its own
 * route: a static sibling of a dynamic segment never resolved here.
 */
export function OverallBudgetDetail({ db, onDone }: { db: Database; onDone: () => void }) {
    return <MainBudgetDetail db={db} onDone={onDone} />;
}

function MainBudgetDetail({ db, onDone }: { db: Database; onDone: () => void }) {
    const router = useRouter();
    const t = useTranslation();
    const currency = useGlobalCurrency(db);
    const nowMs = useNow();
    const [periodOffset, setPeriodOffset] = useState(0);
    const contributions = useExpenseContributions(db, nowMs);
    const budget = useMainBudget(db, nowMs, contributions, periodOffset);
    const transactions = useBudgetContributions(
        db,
        null,
        budget?.window.start ?? null,
        budget ? windowEndMs(budget.window, nowMs) : nowMs
    );

    useEffect(() => {
        if (budget === null) {
            onDone();
        }
    }, [budget, onDone]);

    if (!budget) {
        return <View className="bg-background flex-1" />;
    }

    const confirmDelete = () => {
        confirmDeleteBudget(null, async () => {
            await budgetsRepo.deleteMainBudget(db, budget.id);
            onDone();
        });
    };

    const now = new Date(nowMs);
    const closed = periodOffset < 0;
    const pace = budgetPace(budget.window, now);
    const showMarker = !closed && shouldShowPaceMarker(budget.type, pace.remaining, budget.overBudget);
    const behind = isBehindPace(pace.remaining, budget.amount, budget.leftover);
    const perDay = closed || budget.overBudget ? null : leftPerDay(budget.leftover, budget.window, now);

    return (
        <>
            <BudgetDetailView
                amount={budget.amount}
                closed={closed}
                currency={currency}
                leftover={budget.leftover}
                leftPerDayAmount={perDay}
                onPressTransaction={(txId) => router.push(`/transactions/${txId}`)}
                overBudget={budget.overBudget}
                paceBehind={!closed && behind}
                paceRemaining={showMarker ? pace.remaining : null}
                period={closed ? budgetWindowLabel(budget.window, budget.type) : t(budgetPeriodPhrase(budget.type))}
                spent={budget.spent}
                stepper={
                    budget.periodsBack > 0 ? (
                        <BudgetPeriodStepper
                            maxBack={budget.periodsBack}
                            offset={periodOffset}
                            onStep={setPeriodOffset}
                            type={budget.type}
                            window={budget.window}
                        />
                    ) : null
                }
                transactions={transactions}
            />
            <Stack.Screen.Title>{t("budgets.overall.title")}</Stack.Screen.Title>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("budgets.action.delete")}
                    onPress={confirmDelete}
                    tintColor={Color.ios.systemRed}
                />
            </Stack.Toolbar>
        </>
    );
}
