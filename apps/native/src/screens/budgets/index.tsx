import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { MonoLabel } from "@/components/mono-label";
import { useDisplaySettings, useSettingBool } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { CategoryBudgetView } from "@/data/budgets";
import {
    budgetsRepo,
    compareBudgetSeverity,
    useBurndown,
    useBurndowns,
    useExpenseContributions,
    useMainBudget,
    usePerCategoryBudgets,
} from "@/data/budgets";
import { useCategoryMeta } from "@/data/categories";
import { useSavingsGoals } from "@/data/savings-goals";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { buildBurndown } from "@/domain/budget-burndown";
import { dominantCategory } from "@/domain/budget-dominant";
import { BUDGET_TYPE, periodEnd } from "@/domain/budget-math";
import { firstOfMonth } from "@/domain/dates";
import { useTranslation } from "@/i18n/context";
import { budgetMenuItems } from "@/lib/budget-actions";
import { notifyFailure } from "@/lib/notify";

import { BudgetBurndownHero } from "./components/budget-burndown-hero";
import { BudgetCard } from "./components/budget-card";
import { BudgetEmptyState } from "./components/budget-empty-state";
import { BudgetRings } from "./components/budget-rings";
import { BudgetRow } from "./components/budget-row";
import { SavingsGoalsSection } from "./components/savings-goals-section";

export function Budgets() {
    const db = useDatabase();
    return <BudgetContent db={db} />;
}

/** `gap-3` between the two columns of the card grid. */
const CARD_GUTTER = 12;

function pairs<T>(items: readonly T[]): [T, T | undefined][] {
    const rows: [T, T | undefined][] = [];
    for (let index = 0; index < items.length; index += 2) {
        rows.push([items[index], items[index + 1]]);
    }
    return rows;
}

function BudgetContent({ db }: { db: Database }) {
    const router = useRouter();
    const [gridWidth, setGridWidth] = useState<number | null>(null);
    const t = useTranslation();
    const currency = useGlobalCurrency(db);
    const asRows = useSettingBool("budgetViewStyle");
    const { showCents } = useDisplaySettings().state;
    const nowMs = useNow();
    const goals = useSavingsGoals(db);

    // One transactions subscription for the screen: every hook below derives from
    // this list rather than opening its own listener.
    const contributions = useExpenseContributions(db, nowMs);
    const { pendingId, requestDelete } = useDeferredDelete("budget");
    const mainRow = useMainBudget(db, nowMs, contributions);
    const main = mainRow?.id === pendingId ? null : mainRow;
    const allBudgets = usePerCategoryBudgets(db, nowMs, contributions);
    const budgets = useMemo(() => allBudgets.filter((budget) => budget.id !== pendingId), [allBudgets, pendingId]);
    const mainBurndown = useBurndown(contributions, nowMs, main, null);
    const dominant = useDominant(db, contributions, main, nowMs);
    const burndowns = useBurndowns(contributions, nowMs, budgets);

    const ranked = useMemo(() => [...budgets].sort(compareBudgetSeverity), [budgets]);
    const overCount = budgets.filter((budget) => budget.overBudget).length;

    // Both reads run in render, so null/[] here means the user genuinely has no
    // budgets — the pitch screen can be shown on it without flashing.
    const isEmpty = main === null && budgets.length === 0;

    const monthWindow = useMemo(() => {
        const start = firstOfMonth(new Date(nowMs));
        return { end: periodEnd(start, BUDGET_TYPE.month), start };
    }, [nowMs]);

    const monthToDate = useMemo(
        () =>
            isEmpty
                ? buildBurndown(contributions, {
                      limit: 0,
                      now: new Date(nowMs),
                      window: monthWindow,
                  })
                : null,
        [isEmpty, contributions, monthWindow, nowMs]
    );

    const monthExpenseCount = useMemo(
        () => contributions.filter((row) => row.date.getTime() >= monthWindow.start.getTime()).length,
        [contributions, monthWindow]
    );

    const createMainBudget = async (amount: number) => {
        try {
            await budgetsRepo.createMainBudget(db, {
                amount,
                type: BUDGET_TYPE.month,
            });
        } catch (error) {
            console.error("Failed to create the overall budget", error);
            notifyFailure({ body: t("budgets.save.failedBody"), title: t("budgets.save.failedTitle") });
        }
    };

    // Half the grid less its 12pt gutter. Null until the first layout, which is
    // the frame the cards render flexed and menu-less.
    const cardWidth = gridWidth === null ? null : (gridWidth - CARD_GUTTER) / 2;

    const menuItems = (budget: CategoryBudgetView) =>
        budgetMenuItems({
            onDelete: () => requestDelete(budget.id),
            onEdit: () => router.push(`/budgets/edit/${budget.id}`),
            t,
        });

    if (isEmpty && monthToDate) {
        return (
            <View className="bg-background flex-1 items-center justify-center">
                <BudgetEmptyState
                    burndown={monthToDate}
                    currency={currency}
                    onAddTransaction={() => router.push("/transactions/create")}
                    onCommit={createMainBudget}
                    sampleSize={monthExpenseCount}
                    windowStart={monthWindow.start}
                />
            </View>
        );
    }

    return (
        <ScrollView
            className="bg-background"
            contentContainerStyle={{
                // `NativeTabs` supplies the bar + safe-area inset; this only clears
                // the floating add button.
                paddingBottom: 100,
                paddingHorizontal: 20,
            }}
            contentInsetAdjustmentBehavior="automatic"
            style={{ flex: 1 }}
        >
            {main ? (
                <BudgetBurndownHero
                    budget={main}
                    burndown={mainBurndown}
                    contributions={contributions}
                    currency={currency}
                    dominant={dominant}
                    nowMs={nowMs}
                    onPress={() => router.push("/budgets/overall")}
                />
            ) : null}

            <BudgetRings budgets={ranked} currency={currency} />

            {budgets.length ? (
                <View className="pt-6">
                    <View className="flex-row items-baseline justify-between pb-2">
                        <MonoLabel>{main ? t("budgets.list.categories") : t("budgets.list.budgets")}</MonoLabel>
                        {overCount ? (
                            <MonoLabel>
                                {t("budgets.list.overCount", {
                                    over: overCount,
                                    total: budgets.length,
                                })}
                            </MonoLabel>
                        ) : null}
                    </View>
                    {asRows ? (
                        <View className="divide-border divide-y">
                            {ranked.map((budget) => (
                                <BudgetRow
                                    budget={budget}
                                    burndown={burndowns.get(budget.id) ?? null}
                                    contributions={contributions}
                                    currency={currency}
                                    key={budget.id}
                                    menuItems={menuItems(budget)}
                                    nowMs={nowMs}
                                    onDelete={requestDelete}
                                    onPress={(id) => router.push(`/budgets/${id}`)}
                                />
                            ))}
                        </View>
                    ) : (
                        // Measured rather than flexed: a card's context menu hosts it in
                        // a SwiftUI view that sizes itself from its content, so a card
                        // left on `flex-1` has no width of its own to come back to and
                        // collapses once the menu lifts it out.
                        <View className="gap-3" onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
                            {pairs(ranked).map(([left, right]) => (
                                <View className="flex-row gap-3" key={left.id}>
                                    <BudgetCard
                                        budget={left}
                                        burndown={burndowns.get(left.id) ?? null}
                                        contributions={contributions}
                                        currency={currency}
                                        menuItems={menuItems(left)}
                                        nowMs={nowMs}
                                        onPress={(id) => router.push(`/budgets/${id}`)}
                                        width={cardWidth}
                                    />
                                    {right ? (
                                        <BudgetCard
                                            budget={right}
                                            burndown={burndowns.get(right.id) ?? null}
                                            contributions={contributions}
                                            currency={currency}
                                            menuItems={menuItems(right)}
                                            nowMs={nowMs}
                                            onPress={(id) => router.push(`/budgets/${id}`)}
                                            width={cardWidth}
                                        />
                                    ) : (
                                        // Holds the odd budget out to one column instead of
                                        // letting it stretch across the grid.
                                        <View className="flex-1" />
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ) : null}

            <SavingsGoalsSection
                currency={currency}
                goals={goals}
                onAdd={() => router.push("/(tabs)/budgets/goals/create")}
                onPress={(id) => router.push(`/budgets/goals/${id}`)}
                showCents={showCents}
            />
        </ScrollView>
    );
}

/**
 * The category that took most of the main budget's window, named. Returns null
 * when nothing dominates or the winner has since been deleted, so the sentence
 * simply drops its second clause rather than naming an id.
 */
function useDominant(
    db: Database,
    contributions: readonly ExpenseContribution[],
    main: ReturnType<typeof useMainBudget>,
    nowMs: number
): { name: string; share: number } | null {
    const categoryMeta = useCategoryMeta(db);
    return useMemo(() => {
        if (!main) {
            return null;
        }
        const top = dominantCategory(contributions, main.window, Math.min(nowMs, main.window.end.getTime()));
        const name = top ? categoryMeta.get(top.categoryId)?.name : undefined;
        return top && name ? { name, share: top.share } : null;
    }, [contributions, main, nowMs, categoryMeta]);
}
