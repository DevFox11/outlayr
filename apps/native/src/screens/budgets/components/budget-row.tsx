import * as Haptics from "expo-haptics";
import { useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
	type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated from "react-native-reanimated";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { CategoryBudgetView } from "@/data/budgets";
import type { Burndown } from "@/domain/budget-burndown";
import { buildDaySlots, dayVerdictSentence } from "@/domain/budget-day-slots";
import {
	BUDGET_TYPE,
	budgetTimeLeftLabel,
	leftPerDay,
} from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { confirmDeleteBudget } from "@/lib/budget-actions";
import { BudgetBurndownChart } from "./budget-burndown-chart";
import { BudgetDaySlots } from "./budget-day-slots";

interface BudgetRowProps {
	budget: CategoryBudgetView;
	currency: string;
	onPress: (id: string) => void;
	onLongPress?: (id: string) => void;
	/** Runs once the swipe's Delete is confirmed; the row asks the question itself. */
	onDelete: (id: string) => void;
	showCents?: boolean;
	burndown?: Burndown | null;
	contributions: readonly ExpenseContribution[];
	/** `Date.now()` from the screen, so the clock tracks the same instant as spend. */
	nowMs: number;
}

const THUMB_WIDTH = 88;
const THUMB_HEIGHT = 34;

export function BudgetRow({
	budget,
	currency,
	onPress,
	onLongPress,
	onDelete,
	showCents = true,
	burndown,
	contributions,
	nowMs,
}: BudgetRowProps) {
	const swipeRef = useRef<SwipeableMethods>(null);
	const now = new Date(nowMs);
	const over = budget.overBudget;
	const isDay = budget.type === BUDGET_TYPE.day;
	const dayVerdict = useMemo(() => {
		if (!isDay) {
			return null;
		}
		const slots = buildDaySlots(contributions, {
			limit: budget.amount,
			window: budget.window,
			now: new Date(nowMs),
			categoryId: budget.categoryId,
		});
		return dayVerdictSentence(slots, budget.name);
	}, [isDay, contributions, budget, nowMs]);
	const difference = Math.abs(budget.leftover);
	const perDay = leftPerDay(budget.leftover, budget.window, now);
	// Cents off regardless of the setting: the exact figure is already alongside.
	const meta = [
		`${formatAmount(budget.spent, currency, false)} of ${formatAmount(budget.amount, currency, false)}`,
		budgetTimeLeftLabel(budget.window, budget.type, now),
		over || isDay ? null : `${formatAmount(perDay, currency, false)}/day`,
	]
		.filter(Boolean)
		.join(" · ");

	const renderRightActions = () => (
		<Pressable
			accessibilityLabel={`Delete the ${budget.name} budget`}
			accessibilityRole="button"
			className="my-1 ml-3 items-center justify-center rounded-xl bg-danger px-6"
			onPress={() => {
				void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
				swipeRef.current?.close();
				confirmDeleteBudget(budget.name, () => onDelete(budget.id));
			}}
		>
			<Text className="font-sans-semibold text-subtitle text-white">
				Delete
			</Text>
		</Pressable>
	);

	return (
		<ReanimatedSwipeable
			friction={2}
			onSwipeableWillOpen={() => {
				void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			}}
			overshootRight={false}
			ref={swipeRef}
			renderRightActions={renderRightActions}
			rightThreshold={40}
		>
			<Animated.View className="bg-background">
				<Pressable
					accessibilityRole="button"
					className="flex-row items-center gap-3 py-3.5 active:opacity-70"
					onLongPress={onLongPress ? () => onLongPress(budget.id) : undefined}
					onPress={() => onPress(budget.id)}
				>
					<View className="flex-1 gap-1">
						<View className="flex-row items-center gap-2">
							<View
								className="size-2 rounded-full"
								style={{ backgroundColor: budget.color }}
							/>
							<Text
								className="flex-1 font-sans-semibold text-body text-foreground"
								numberOfLines={1}
							>
								{budget.name}
							</Text>
							<Text
								className={cn(
									"font-sans-semibold text-body",
									over ? "text-over-budget" : "text-foreground",
								)}
								numberOfLines={1}
								style={{ fontVariant: ["tabular-nums"] }}
							>
								{formatAmount(difference, currency, showCents)}
								<Text className="font-sans-medium text-label text-muted">
									{over ? " over" : " left"}
								</Text>
							</Text>
						</View>
						<MonoLabel numberOfLines={1}>{meta}</MonoLabel>

						{isDay && dayVerdict ? (
							<Text className="pt-1 text-foreground text-label">
								{dayVerdict}
							</Text>
						) : null}
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
								showCents={showCents}
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
