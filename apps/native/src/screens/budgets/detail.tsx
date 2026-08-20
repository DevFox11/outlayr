import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/text";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useSettingNumber } from "@/contexts/display-settings-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { budgetsRepo, useCategoryBudget } from "@/data/budgets";
import { useDeferredDelete } from "@/data/use-deferred-delete";
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
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";
import { BudgetDetailView } from "@/screens/budgets/components/budget-detail-view";
import { BudgetEditor } from "@/screens/budgets/components/budget-editor";
import type { BudgetEdit } from "@/screens/budgets/components/budget-editor";
import type { LimitCommit } from "@/screens/budgets/components/budget-limit-body";
import { BudgetLimitSheet } from "@/screens/budgets/components/budget-limit-sheet";
import { BudgetPeriodStepper } from "@/screens/budgets/components/budget-period-stepper";

export function BudgetDetail({ db, id, onDone }: { db: Database; id: string; onDone: () => void }) {
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const currency = useGlobalCurrency(db);
    const nowMs = useNow();
    const [periodOffset, setPeriodOffset] = useState(0);
    const { budget, transactions, periodsBack, contributions } = useCategoryBudget(db, id, nowMs, periodOffset);
    const { requestDelete } = useDeferredDelete("budget");
    const limitSheetRef = useRef<BottomSheetModal>(null);
    const firstDayOfMonth = useSettingNumber("firstDayOfMonth");
    const firstWeekday = useSettingNumber("firstWeekday");
    const calendar = useMemo(() => ({ firstDayOfMonth, firstWeekday }), [firstDayOfMonth, firstWeekday]);

    useEffect(() => {
        if (budget === null) {
            onDone();
        }
    }, [budget, onDone]);

    if (!budget) {
        return <View className="bg-background flex-1" />;
    }

    // Left rather than waited on: the write is held for the undo window, so the
    // budget is still readable and this screen would otherwise sit on a row it has
    // already taken off the list behind it.
    const deleteBudget = () => {
        requestDelete(budget.id);
        onDone();
    };

    /** Reports whether the write landed, so only a real one is felt. */
    const write = async (edit: BudgetEdit) => {
        try {
            await budgetsRepo.patchBudget(db, budget.id, edit);
            return true;
        } catch (error) {
            console.error("Failed to change the budget", error);
            notifyFailure({ body: t("budgets.save.failedBody"), title: t("budgets.save.failedTitle") });
            return false;
        }
    };

    const commitLimit = async ({ limit, limitChanged, type }: LimitCommit) => {
        limitSheetRef.current?.dismiss();
        // An untouched figure is left out of the patch: see `LimitCommit`.
        if (await write({ ...(limitChanged && { amount: limit }), type })) {
            haptics("success");
        }
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
                editor={
                    // Only ever the live window: a closed one is a record, and the
                    // budget being edited is not the budget on screen.
                    closed ? (
                        <Text className="text-muted text-subtitle pt-6 leading-snug">
                            {t("budgets.editor.closedWindow")}
                        </Text>
                    ) : (
                        <BudgetEditor
                            amount={budget.amount}
                            calendar={calendar}
                            carry={budget.carry}
                            currency={currency}
                            foreignCurrency={budget.currency === currency ? null : budget.currency}
                            limit={budget.limit}
                            name={budget.customName}
                            namePlaceholder={budget.name}
                            nowMs={nowMs}
                            onChange={write}
                            onChangeLimit={() => limitSheetRef.current?.present()}
                            rollover={budget.rollover}
                            startDate={budget.anchor}
                            type={budget.type}
                        />
                    )
                }
                leftover={budget.leftover}
                leftPerDayAmount={perDay}
                onPressTransaction={(txId) => router.push(`/transactions/${txId}`)}
                overBudget={budget.overBudget}
                paceBehind={!closed && behind}
                paceRemaining={showMarker ? pace.remaining : null}
                period={closed ? budgetWindowLabel(budget.window, budget.type) : t(budgetPeriodPhrase(budget.type))}
                spent={budget.spent}
                stepper={
                    periodsBack > 0 ? (
                        <BudgetPeriodStepper
                            maxBack={periodsBack}
                            offset={periodOffset}
                            onStep={setPeriodOffset}
                            type={budget.type}
                            window={budget.window}
                        />
                    ) : null
                }
                tint={budget.color}
                transactions={transactions}
            />

            <BudgetLimitSheet
                calendar={calendar}
                contributions={contributions}
                currency={currency}
                nowMs={nowMs}
                onCommit={commitLimit}
                ref={limitSheetRef}
                target={{
                    categoryId: budget.categoryId,
                    color: budget.color,
                    emoji: budget.emoji,
                    icon: budget.icon,
                    limit: budget.limit,
                    name: budget.name,
                    type: budget.type,
                    window: budget.window,
                }}
            />

            <Stack.Screen.Title>{budget.name}</Stack.Screen.Title>
            <Stack.Toolbar placement="right">
                {/* A menu on the bar button, not an alert behind it: these are
				    neutral choices, and the delete asks its own question. */}
                <Stack.Toolbar.Menu {...toolbarIcon("more")} accessibilityLabel={t("budgets.action.moreA11y")}>
                    <Stack.Toolbar.MenuAction destructive icon="trash" onPress={deleteBudget}>
                        {t("common.delete")}
                    </Stack.Toolbar.MenuAction>
                </Stack.Toolbar.Menu>
            </Stack.Toolbar>
        </>
    );
}
