import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Color, Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/text";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useSettingNumber } from "@/contexts/display-settings-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
    budgetsRepo,
    useBudgetContributions,
    useExpenseContributions,
    useMainBudget,
    windowEndMs,
} from "@/data/budgets";
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

/**
 * Lives under `/budgets/[id]` with the reserved id `overall` rather than its own
 * route: a static sibling of a dynamic segment never resolved here.
 */
export function OverallBudgetDetail({ db, onDone }: { db: Database; onDone: () => void }) {
    const router = useRouter();
    const t = useTranslation();
    const haptics = useHaptics();
    const currency = useGlobalCurrency(db);
    const nowMs = useNow();
    const [periodOffset, setPeriodOffset] = useState(0);
    const { requestDelete } = useDeferredDelete("budget");
    const limitSheetRef = useRef<BottomSheetModal>(null);
    const firstDayOfMonth = useSettingNumber("firstDayOfMonth");
    const firstWeekday = useSettingNumber("firstWeekday");
    const calendar = useMemo(() => ({ firstDayOfMonth, firstWeekday }), [firstDayOfMonth, firstWeekday]);
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

    // No confirmation in front of it: the write is held for the undo window. This
    // screen leaves rather than waiting on it, because the budget is still
    // readable and it would otherwise sit on a row already gone from the list
    // behind it.
    const deleteBudget = () => {
        requestDelete(budget.id);
        onDone();
    };

    // Field-level throughout. Re-pointing this budget through `createMainBudget`
    // is what used to clear its name and turn carry-over off, because that call
    // only preserves a column the caller leaves undefined.
    /** Reports whether the write landed, so only a real one is felt. */
    const write = async (edit: BudgetEdit) => {
        try {
            await budgetsRepo.patchMainBudget(db, budget.id, edit);
            return true;
        } catch (error) {
            console.error("Failed to change the overall budget", error);
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

            <BudgetLimitSheet
                calendar={calendar}
                contributions={contributions}
                currency={currency}
                nowMs={nowMs}
                onCommit={commitLimit}
                ref={limitSheetRef}
                target={{
                    categoryId: null,
                    limit: budget.limit,
                    // The scope reads mid-sentence, so the standing-in label is a word
                    // rather than a name. A budget the user named keeps its own casing.
                    name: budget.customName ?? t("budgets.scope.everything").toLocaleLowerCase(),
                    type: budget.type,
                    window: budget.window,
                }}
            />

            <Stack.Screen.Title>{budget.name}</Stack.Screen.Title>
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("delete")}
                    accessibilityLabel={t("budgets.action.delete")}
                    onPress={deleteBudget}
                    tintColor={Color.ios.systemRed}
                />
            </Stack.Toolbar>
        </>
    );
}
