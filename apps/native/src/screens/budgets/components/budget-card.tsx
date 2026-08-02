import { useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { CategoryBudgetView } from "@/data/budgets";
import type { Burndown } from "@/domain/budget-burndown";
import { BUDGET_TYPE, budgetTimeLeftLabel } from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { BudgetBurndownChart } from "./budget-burndown-chart";
import { BudgetDaySlots } from "./budget-day-slots";

interface BudgetCardProps {
	budget: CategoryBudgetView;
	currency: string;
	onPress: (id: string) => void;
	onLongPress: (id: string) => void;
	burndown?: Burndown | null;
	contributions: readonly ExpenseContribution[];
	/** `Date.now()` from the screen, so the clock tracks the same instant as spend. */
	nowMs: number;
}

const THUMB_HEIGHT = 40;

/**
 * The grid presentation of a budget, behind the Budget Rows setting. Half the
 * screen wide, so it carries the same figures as `BudgetRow` minus the per-day
 * pace — the line that reads as noise once it has to wrap.
 *
 * No swipe-to-delete: the gesture reads as a scroll fight when the cell is only
 * half a screen wide. Long press opens the same actions the row's swipe does.
 */
export function BudgetCard({
	budget,
	currency,
	onPress,
	onLongPress,
	burndown,
	contributions,
	nowMs,
}: BudgetCardProps) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	const [chartWidth, setChartWidth] = useState(0);
	const now = new Date(nowMs);
	const over = budget.overBudget;
	const isDay = budget.type === BUDGET_TYPE.day;
	const difference = Math.abs(budget.leftover);
	const differenceLabel = formatAmount(difference, currency, showCents);

	const onLayout = (event: LayoutChangeEvent) => {
		setChartWidth(event.nativeEvent.layout.width);
	};

	return (
		<Pressable
			accessibilityLabel={
				over
					? t("budgets.card.a11yOver", {
							name: budget.name,
							amount: differenceLabel,
						})
					: t("budgets.card.a11yLeft", {
							name: budget.name,
							amount: differenceLabel,
						})
			}
			accessibilityRole="button"
			className="flex-1 gap-2 rounded-xl border border-border p-3 active:opacity-70"
			onLongPress={() => onLongPress(budget.id)}
			onPress={() => onPress(budget.id)}
		>
			<View className="flex-row items-center gap-2">
				<View
					className="size-2 rounded-full"
					style={{ backgroundColor: budget.color }}
				/>
				<Text
					className="flex-1 font-sans-semibold text-foreground text-subtitle"
					numberOfLines={1}
				>
					{budget.name}
				</Text>
			</View>

			<Text
				className={cn(
					"font-sans-semibold text-body",
					over ? "text-over-budget" : "text-foreground",
				)}
				numberOfLines={1}
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{differenceLabel}
				<Text className="font-sans-medium text-label text-muted">
					{` ${over ? t("budgets.suffix.over") : t("budgets.suffix.left")}`}
				</Text>
			</Text>

			{isDay ? (
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
			) : null}

			{isDay || !burndown ? null : (
				<View onLayout={onLayout} style={{ height: THUMB_HEIGHT }}>
					{chartWidth > 0 ? (
						<BudgetBurndownChart
							burndown={burndown}
							domain="limit"
							height={THUMB_HEIGHT}
							interactive={false}
							limit={budget.amount}
							width={chartWidth}
						/>
					) : null}
				</View>
			)}

			<MonoLabel numberOfLines={1}>
				{`${t("budgets.spentOfLimit", {
					spent: formatAmount(budget.spent, currency, false),
					limit: formatAmount(budget.amount, currency, false),
				})} · ${budgetTimeLeftLabel(budget.window, budget.type, now, t)}`}
			</MonoLabel>
		</Pressable>
	);
}
