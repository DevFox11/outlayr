import type { BottomSheetModal } from "@expo/ui/community/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { CategoryPickerSheet } from "@/components/category-picker-sheet";
import { useCategoryPickerField } from "@/components/form/category-picker-field";
import { MonoLabel } from "@/components/mono-label";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDisplaySettings, useSettingBool, useSettingNumber } from "@/contexts/display-settings-context";
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
    useUnbudgetedScopes,
} from "@/data/budgets";
import { useCategoryMeta } from "@/data/categories";
import { useSavingsGoals } from "@/data/savings-goals";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { dominantCategory } from "@/domain/budget-dominant";
import { BUDGET_TYPE } from "@/domain/budget-math";
import { useTranslation } from "@/i18n/context";
import { budgetMenuItems } from "@/lib/budget-actions";
import { notifyFailure } from "@/lib/notify";
import { useHaptics } from "@/lib/use-haptics";

import { BudgetBurndownHero } from "./components/budget-burndown-hero";
import { BudgetCard } from "./components/budget-card";
import { BudgetEmptyState } from "./components/budget-empty-state";
import type { LimitCommit, LimitTarget } from "./components/budget-limit-body";
import { BudgetLimitSheet } from "./components/budget-limit-sheet";
import { BudgetRings } from "./components/budget-rings";
import { BudgetRow } from "./components/budget-row";
import { SavingsGoalsSection } from "./components/savings-goals-section";
import { UnbudgetedRail } from "./components/unbudgeted-rail";

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
    const haptics = useHaptics();
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
    // `main` is what the screen draws: a budget inside its undo window is gone as
    // far as the reader is concerned. `mainRow` is what still exists, and it is
    // the one every *creation* affordance has to consult — the overall budget is a
    // singleton the repo re-points by id, so setting a new one while the old is
    // pending writes the same row the delete is about to tombstone.
    const main = mainRow?.id === pendingId ? null : mainRow;
    const allBudgets = usePerCategoryBudgets(db, nowMs, contributions);
    const budgets = useMemo(() => allBudgets.filter((budget) => budget.id !== pendingId), [allBudgets, pendingId]);
    const mainBurndown = useBurndown(contributions, nowMs, main, null);
    const dominant = useDominant(db, contributions, main, nowMs);
    const burndowns = useBurndowns(contributions, nowMs, budgets);

    const ranked = useMemo(() => [...budgets].sort(compareBudgetSeverity), [budgets]);
    // A category holds at most one budget (`budgets.categoryId` is unique), so the
    // picker must not offer one that already has it — the save would fail on the
    // constraint with nothing on screen to explain why. Built from `allBudgets`,
    // not the list on screen: a budget inside its undo window is off the list and
    // still owns its category id until the delete actually commits.
    const budgetedCategoryIds = useMemo(
        () => allBudgets.map((budget) => budget.categoryId).filter((id): id is string => id !== null),
        [allBudgets]
    );
    const overCount = budgets.filter((budget) => budget.overBudget).length;

    // Both reads run in render, so null/[] here means the user genuinely has no
    // budgets — the pitch screen can be shown on it without flashing. Rows still
    // inside an undo window count as budgets: they exist, they can be undone, and
    // the first-run takeover has no business appearing over one.
    const isEmpty = mainRow === null && allBudgets.length === 0;

    const firstDayOfMonth = useSettingNumber("firstDayOfMonth");
    const firstWeekday = useSettingNumber("firstWeekday");
    const calendar = useMemo(() => ({ firstDayOfMonth, firstWeekday }), [firstDayOfMonth, firstWeekday]);
    const rail = useUnbudgetedScopes(db, nowMs, contributions);

    const limitSheetRef = useRef<BottomSheetModal>(null);
    const [limitTarget, setLimitTarget] = useState<LimitTarget | null>(null);

    // Presenting from an effect rather than from `openLimit` itself: `menuItems`
    // runs during render to build each card's context menu, so a closure that
    // reached for `limitSheetRef.current` would be a ref read in render as far as
    // the compiler can tell. Setting state is not.
    const openLimit = setLimitTarget;
    useEffect(() => {
        if (limitTarget) {
            limitSheetRef.current?.present();
        }
    }, [limitTarget]);

    const {
        present: presentCategoryPicker,
        ref: categoryPickerRef,
        select: selectCategory,
    } = useCategoryPickerField((picked) =>
        openLimit({
            categoryId: picked.id,
            color: picked.color,
            emoji: picked.emoji,
            icon: picked.icon,
            limit: null,
            name: picked.name ?? t("budgets.name.default"),
            type: BUDGET_TYPE.month,
        })
    );

    const commitEverything = async ({ limit, type }: LimitCommit) => {
        try {
            await budgetsRepo.createMainBudget(db, { amount: limit, type });
            haptics("success");
        } catch (error) {
            console.error("Failed to create the overall budget", error);
            notifyFailure({ body: t("budgets.save.failedBody"), title: t("budgets.save.failedTitle") });
        }
    };

    /**
     * One commit for every scope: the overall budget is a singleton the repo
     * re-points, a category budget is created once and patched after that.
     */
    const commitLimit = async ({ limit, limitChanged, type }: LimitCommit) => {
        const target = limitTarget;
        if (!target) {
            return;
        }
        limitSheetRef.current?.dismiss();
        try {
            if (target.categoryId === null) {
                await budgetsRepo.createMainBudget(db, { amount: limit, type });
                haptics("success");
                return;
            }
            // `allBudgets`, so a scope whose budget is inside its undo window is
            // still recognised as budgeted — inserting a second row for it would
            // fail on the unique category id.
            const existing = allBudgets.find((budget) => budget.categoryId === target.categoryId);
            // An untouched figure is left out of the patch: see `LimitCommit`.
            await (existing
                ? budgetsRepo.patchBudget(db, existing.id, { ...(limitChanged && { amount: limit }), type })
                : budgetsRepo.createBudget(db, { amount: limit, categoryId: target.categoryId, type }));
            haptics("success");
        } catch (error) {
            console.error("Failed to save the budget", error);
            notifyFailure({ body: t("budgets.save.failedBody"), title: t("budgets.save.failedTitle") });
        }
    };

    // Half the grid less its 12pt gutter. Null until the first layout, which is
    // the frame the cards render flexed and menu-less.
    const cardWidth = gridWidth === null ? null : (gridWidth - CARD_GUTTER) / 2;

    const menuItems = (budget: CategoryBudgetView) =>
        budgetMenuItems({
            onChangeLimit: () =>
                openLimit({
                    categoryId: budget.categoryId,
                    color: budget.color,
                    emoji: budget.emoji,
                    icon: budget.icon,
                    limit: budget.limit,
                    name: budget.name,
                    type: budget.type,
                    window: budget.window,
                }),
            onDelete: () => requestDelete(budget.id),
            t,
        });

    if (isEmpty) {
        return (
            <View className="bg-background flex-1 justify-center">
                <BudgetEmptyState
                    calendar={calendar}
                    contributions={contributions}
                    currency={currency}
                    nowMs={nowMs}
                    onAddTransaction={() => router.push("/transactions/create")}
                    onCommit={commitEverything}
                />
            </View>
        );
    }

    return (
        <>
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

                <UnbudgetedRail
                    currency={currency}
                    everythingTypical={rail.everything}
                    onPress={(scope) =>
                        openLimit(
                            scope
                                ? {
                                      categoryId: scope.categoryId,
                                      color: scope.color,
                                      emoji: scope.emoji,
                                      icon: scope.icon,
                                      limit: null,
                                      name: scope.name,
                                      type: BUDGET_TYPE.month,
                                      window: rail.window,
                                  }
                                : {
                                      categoryId: null,
                                      limit: null,
                                      name: t("budgets.scope.everything").toLocaleLowerCase(),
                                      type: BUDGET_TYPE.month,
                                      window: rail.window,
                                  }
                        )
                    }
                    offerEverything={mainRow === null}
                    periodPhrase={t("budgets.periodPhrase.month")}
                    scopes={rail.scopes}
                />

                <SavingsGoalsSection
                    currency={currency}
                    goals={goals}
                    onAdd={() => router.push("/(tabs)/budgets/goals/create")}
                    onPress={(id) => router.push(`/budgets/goals/${id}`)}
                    showCents={showCents}
                />
            </ScrollView>

            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("add")}
                    accessibilityLabel={t("budgets.rail.another")}
                    onPress={presentCategoryPicker}
                />
            </Stack.Toolbar>

            <BudgetLimitSheet
                calendar={calendar}
                contributions={contributions}
                currency={currency}
                nowMs={nowMs}
                onCommit={commitLimit}
                ref={limitSheetRef}
                target={limitTarget}
            />
            <CategoryPickerSheet
                db={db}
                excludeIds={budgetedCategoryIds}
                income={false}
                onSelect={selectCategory}
                ref={categoryPickerRef}
                selectedId={null}
            />
        </>
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
