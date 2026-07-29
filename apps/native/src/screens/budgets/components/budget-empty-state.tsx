import { Pressable, View } from "react-native";
import { Text } from "@/components/text";
import type { Burndown } from "@/domain/budget-burndown";
import { useTranslation } from "@/i18n";
import { BudgetLimitPicker } from "./budget-limit-picker";

interface BudgetEmptyStateProps {
	/** Month-to-date burn-down built with `limit: 0` — the curve to place a limit on. */
	burndown: Burndown;
	/** How many expenses are behind the curve. */
	sampleSize: number;
	currency: string;
	windowStart: Date;
	showCents?: boolean;
	onAddTransaction: () => void;
	onCommit: (limit: number) => void;
}

export function BudgetEmptyState({
	burndown,
	sampleSize,
	currency,
	windowStart,
	showCents = true,
	onAddTransaction,
	onCommit,
}: BudgetEmptyStateProps) {
	if (sampleSize === 0) {
		return <NothingToBudget onAddTransaction={onAddTransaction} />;
	}

	return (
		<BudgetLimitPicker
			burndown={burndown}
			currency={currency}
			onCommit={onCommit}
			sampleSize={sampleSize}
			showCents={showCents}
			windowStart={windowStart}
		/>
	);
}

function NothingToBudget({
	onAddTransaction,
}: {
	onAddTransaction: () => void;
}) {
	const t = useTranslation();
	return (
		<View className="flex-1 items-center justify-center px-8">
			<Text className="pb-2 font-sans-semibold text-foreground text-title">
				{t("budgets.empty.title")}
			</Text>
			<Text className="pb-7 text-center text-muted text-subtitle">
				{t("budgets.empty.body")}
			</Text>
			<Pressable
				accessibilityRole="button"
				className="rounded-full bg-accent px-7 py-3.5 active:opacity-80"
				onPress={onAddTransaction}
			>
				<Text className="font-sans-semibold text-accent-foreground text-body">
					{t("budgets.empty.action")}
				</Text>
			</Pressable>
		</View>
	);
}
