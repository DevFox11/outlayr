import { useMemo, useRef } from "react";
import { type AccessibilityActionEvent, Pressable, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { CategoryBudgetView } from "@/data/budgets";
import type { Burndown } from "@/domain/budget-burndown";
import { buildDaySlots, dayVerdictSentence } from "@/domain/budget-day-slots";
import { BUDGET_TYPE, budgetTimeLeftLabel, leftPerDay } from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n/context";
import { confirmDeleteBudget } from "@/lib/budget-actions";
import { useHaptics } from "@/lib/use-haptics";
import { BudgetBurndownChart } from "./budget-burndown-chart";
import { BudgetDaySlots } from "./budget-day-slots";

interface BudgetRowProps {
	budget: CategoryBudgetView;
	burndown?: Burndown | null;
	contributions: readonly ExpenseContribution[];
	currency: string;
	/** `Date.now()` from the screen, so the clock tracks the same instant as spend. */
	nowMs: number;
	/** Runs once the swipe's Delete is confirmed; the row asks the question itself. */
	onDelete: (id: string) => void;
	onLongPress?: (id: string) => void;
	onPress: (id: string) => void;
}

const THUMB_WIDTH = 88;
const THUMB_HEIGHT = 34;

/** Custom, so it surfaces in the rotor's Actions rather than replacing a tap. */
const DELETE_ACTION = "delete";

export function BudgetRow({
	budget,
	currency,
	onPress,
	onLongPress,
	onDelete,
	burndown,
	contributions,
	nowMs,
}: BudgetRowProps) {
	const { showCents } = useDisplaySettings().state;
	const haptics = useHaptics();
	const t = useTranslation();
	const swipeRef = useRef<SwipeableMethods>(null);
	const now = new Date(nowMs);
	const over = budget.overBudget;
	const isDay = budget.type === BUDGET_TYPE.day;
	const dayVerdict = useMemo(() => {
		if (!isDay) {
			return null;
		}
		const slots = buildDaySlots(contributions, {
			categoryId: budget.categoryId,
			limit: budget.amount,
			now: new Date(nowMs),
			window: budget.window,
		});
		return dayVerdictSentence(slots, budget.name, t);
	}, [isDay, contributions, budget, nowMs, t]);
	const difference = Math.abs(budget.leftover);
	const perDay = leftPerDay(budget.leftover, budget.window, now);
	// Cents off regardless of the setting: the exact figure is already alongside.
	const meta = [
		t("budgets.spentOfLimit", {
			limit: formatAmount(budget.amount, currency, false),
			spent: formatAmount(budget.spent, currency, false),
		}),
		budgetTimeLeftLabel(budget.window, budget.type, now, t),
		over || isDay ? null : t("budgets.perDay", { amount: formatAmount(perDay, currency, false) }),
	]
		.filter(Boolean)
		.join(" · ");

	const requestDelete = () => {
		confirmDeleteBudget(budget.name, () => onDelete(budget.id));
	};

	const renderRightActions = () => (
		<Pressable
			accessibilityLabel={t("budgets.row.deleteA11y", { name: budget.name })}
			accessibilityRole="button"
			className="my-1 ml-3 items-center justify-center rounded-xl bg-danger-fill px-6"
			onPress={() => {
				haptics("heavy");
				swipeRef.current?.close();
				requestDelete();
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
				<Pressable
					// Delete otherwise lives only behind the right swipe, which is a pan no
					// assistive gesture can perform.
					accessibilityActions={[
						{
							label: t("budgets.row.deleteA11y", { name: budget.name }),
							name: DELETE_ACTION,
						},
					]}
					accessibilityHint={onLongPress ? t("budgets.row.actionsHint") : undefined}
					accessibilityRole="button"
					className="flex-row items-center gap-3 py-3.5 active:opacity-70"
					onAccessibilityAction={(event: AccessibilityActionEvent) => {
						if (event.nativeEvent.actionName === DELETE_ACTION) {
							requestDelete();
						}
					}}
					onLongPress={onLongPress ? () => onLongPress(budget.id) : undefined}
					onPress={() => onPress(budget.id)}
				>
					<View className="flex-1 gap-1">
						<View className="flex-row items-center gap-2">
							<View className="size-2 rounded-full" style={{ backgroundColor: budget.color }} />
							<Text className="flex-1 font-sans-semibold text-body text-foreground" numberOfLines={1}>
								{budget.name}
							</Text>
							<Text
								className={cn("font-sans-semibold text-body", over ? "text-over-budget" : "text-foreground")}
								numberOfLines={1}
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{formatAmount(difference, currency, showCents)}
								<Text className="font-sans-medium text-label text-muted">
									{` ${over ? t("budgets.suffix.over") : t("budgets.suffix.left")}`}
								</Text>
							</Text>
						</View>
						<MonoLabel numberOfLines={1}>{meta}</MonoLabel>

						{isDay && dayVerdict ? <Text className="pt-1 text-foreground text-label">{dayVerdict}</Text> : null}
					</View>

					{isDay ? (
						<View style={{ width: THUMB_WIDTH }}>
							<BudgetDaySlots
								bandOnly
								categoryId={budget.categoryId}
								compact
								contributions={contributions}
								currency={currency}
								limit={budget.amount}
								noun={budget.name}
								nowMs={nowMs}
								window={budget.window}
							/>
						</View>
					) : null}

					{isDay || !burndown ? null : (
						<BudgetBurndownChart
							burndown={burndown}
							domain="limit"
							height={THUMB_HEIGHT}
							interactive={false}
							limit={budget.amount}
							width={THUMB_WIDTH}
						/>
					)}
				</Pressable>
			</Animated.View>
		</ReanimatedSwipeable>
	);
}
