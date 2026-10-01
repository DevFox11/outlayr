import { useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";

import { ActionMenu } from "@/components/action-menu";
import type { ActionMenuItem } from "@/components/action-menu";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { CategoryBudgetView } from "@/data/budgets";
import { buildDaySlots, dayVerdictSentence } from "@/domain/budget-day-slots";
import { BUDGET_TYPE, leftPerDay } from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { useOverBudgetMoment } from "@/hooks/use-over-budget-moment";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useHaptics } from "@/lib/use-haptics";

import { timeLeftUnlessHeroShows } from "../time-left";
import { BudgetDaySlots, drawsDaySlots } from "./budget-day-slots";
import { BudgetProgressBar } from "./budget-progress-bar";

interface BudgetRowProps {
    budget: CategoryBudgetView;
    contributions: readonly ExpenseContribution[];
    currency: string;
    heroTimeLeft: string | null;
    /** The row's context menu, opened by holding it. Omit where there is none. */
    menuItems?: readonly ActionMenuItem[];
    /** `Date.now()` from the screen, so the clock tracks the same instant as spend. */
    nowMs: number;
    /** Takes the row off the list and starts its undo window. No confirmation. */
    onDelete: (id: string) => void;
    onPress: (id: string) => void;
}

/** Custom, so it surfaces in the rotor's Actions rather than replacing a tap. */
const DELETE_ACTION = "delete";

export function BudgetRow({
    budget,
    currency,
    onPress,
    menuItems,
    onDelete,
    contributions,
    heroTimeLeft,
    nowMs,
}: BudgetRowProps) {
    const { showCents } = useDisplaySettings().state;
    const haptics = useHaptics();
    const t = useTranslation();
    const { language } = useLanguage();
    const swipeRef = useRef<SwipeableMethods>(null);
    const now = new Date(nowMs);
    const over = budget.overBudget;
    const crossedStyle = useOverBudgetMoment(budget.id, over, budget.window.start);
    const isDay = budget.type === BUDGET_TYPE.day;
    const daySlots = useMemo(
        () =>
            isDay
                ? buildDaySlots(contributions, {
                      categoryId: budget.categoryId,
                      limit: budget.amount,
                      now: new Date(nowMs),
                      window: budget.window,
                  })
                : null,
        [isDay, contributions, budget, nowMs]
    );
    const dayVerdict = daySlots ? dayVerdictSentence(daySlots, budget.name, t) : null;
    const difference = Math.abs(budget.leftover);
    const perDay = leftPerDay(budget.leftover, budget.window, now);
    // Cents off regardless of the setting: the exact figure is already alongside.
    const meta = [
        t("budgets.spentOfLimit", {
            limit: formatAmount(budget.amount, currency, false, language),
            spent: formatAmount(budget.spent, currency, false, language),
        }),
        timeLeftUnlessHeroShows(budget, heroTimeLeft, now, t),
        over || isDay ? null : t("budgets.perDay", { amount: formatAmount(perDay, currency, false, language) }),
    ]
        .filter(Boolean)
        .join(" · ");

    const renderRightActions = () => (
        <Pressable
            accessibilityLabel={t("budgets.row.deleteA11y", { name: budget.name })}
            accessibilityRole="button"
            className="bg-danger-fill my-1 ml-3 items-center justify-center rounded-xl px-6"
            onPress={() => {
                haptics("heavy");
                swipeRef.current?.close();
                onDelete(budget.id);
            }}
        >
            <Text className="font-sans-semibold text-subtitle text-white">{t("budgets.action.delete")}</Text>
        </Pressable>
    );

    return (
        <ReanimatedSwipeable
            friction={2}
            onSwipeableWillOpen={() => {
                haptics("light");
            }}
            overshootRight={false}
            ref={swipeRef}
            renderRightActions={renderRightActions}
            rightThreshold={40}
        >
            <Animated.View className="bg-background">
                <ActionMenu items={menuItems ?? []}>
                    <Pressable
                        // Delete otherwise lives only behind the right swipe, which is a pan no
                        // assistive gesture can perform.
                        accessibilityActions={[
                            {
                                label: t("budgets.row.deleteA11y", { name: budget.name }),
                                name: DELETE_ACTION,
                            },
                        ]}
                        accessibilityHint={menuItems?.length ? t("budgets.row.actionsHint") : undefined}
                        accessibilityRole="button"
                        // The menu lifts this row into its preview, so the row carries the
                        // ground it is snapshotted against rather than borrowing the list's.
                        className="bg-background gap-2 py-3.5 active:opacity-70"
                        onAccessibilityAction={(event: AccessibilityActionEvent) => {
                            if (event.nativeEvent.actionName === DELETE_ACTION) {
                                onDelete(budget.id);
                            }
                        }}
                        onPress={() => onPress(budget.id)}
                    >
                        <View className="flex-row items-center gap-2">
                            <Text className="font-sans-semibold text-body text-foreground flex-1" numberOfLines={1}>
                                {budget.name}
                            </Text>
                            <Animated.View style={crossedStyle}>
                                <Text
                                    className={cn(
                                        "tabular-nums",
                                        "font-sans-semibold text-body",
                                        over ? "text-over-budget" : "text-foreground"
                                    )}
                                    numberOfLines={1}
                                >
                                    {formatAmount(difference, currency, showCents, language)}
                                    <Text className="font-sans-medium text-label text-muted">
                                        {` ${over ? t("budgets.suffix.over") : t("budgets.suffix.left")}`}
                                    </Text>
                                </Text>
                            </Animated.View>
                        </View>
                        {daySlots && drawsDaySlots(daySlots) ? (
                            <BudgetDaySlots
                                categoryId={budget.categoryId}
                                className="pt-0"
                                compact
                                contributions={contributions}
                                currency={currency}
                                limit={budget.amount}
                                nowMs={nowMs}
                                tint={budget.color}
                                window={budget.window}
                            />
                        ) : (
                            <BudgetProgressBar limit={budget.amount} spent={budget.spent} tint={budget.color} />
                        )}
                        <MonoLabel numberOfLines={1}>{meta}</MonoLabel>
                        {dayVerdict ? <Text className="text-foreground text-label">{dayVerdict}</Text> : null}
                    </Pressable>
                </ActionMenu>
            </Animated.View>
        </ReanimatedSwipeable>
    );
}
