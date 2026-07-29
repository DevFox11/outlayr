import { useMemo } from "react";
import { SectionList, View } from "react-native";
import { HeroNumber } from "@/components/amount-text";
import { DaySectionHeader } from "@/components/day-section-header";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { useValuation } from "@/data/use-valuation";
import { groupByDay } from "@/domain/day-sections";
import { formatAmount } from "@/domain/money";
import { BudgetProgressBar } from "./budget-progress-bar";

interface BudgetDetailViewProps {
	/** Lowercase period phrase, e.g. "this month". */
	period: string;
	spent: number;
	amount: number;
	leftover: number;
	overBudget: boolean;
	currency: string;
	transactions: TransactionWithCategory[];
	onPressTransaction: (id: string) => void;
	/** Fraction of period time remaining, or null to hide the pace marker. */
	paceRemaining?: number | null;
	/** True when spending has outrun the clock. */
	paceBehind?: boolean;
	leftPerDayAmount?: number | null;
	showCents?: boolean;
	showSign?: boolean;
}

/** Matches the list hero's bleed, so both rails read as the same instrument. */
const RAIL_BLEED = 8;

/** Shared budget detail body for both the per-category and overall budgets. */
export function BudgetDetailView({
	period,
	spent,
	amount,
	leftover,
	overBudget,
	currency,
	transactions,
	onPressTransaction,
	paceRemaining = null,
	paceBehind = false,
	leftPerDayAmount = null,
	showCents = true,
	showSign = true,
}: BudgetDetailViewProps) {
	const { rates } = useValuation(useDatabase());
	const sections = useMemo(
		() => groupByDay(transactions, currency, rates),
		[transactions, currency, rates],
	);

	return (
		<SectionList
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
			sections={sections}
			keyExtractor={(item) => item.id}
			stickySectionHeadersEnabled={false}
			contentContainerClassName="px-5 pt-2 pb-safe-offset-10"
			ListHeaderComponent={
				<BudgetSummary
					period={period}
					spent={spent}
					amount={amount}
					leftover={leftover}
					overBudget={overBudget}
					currency={currency}
					paceRemaining={paceRemaining}
					paceBehind={paceBehind}
					leftPerDayAmount={leftPerDayAmount}
					showCents={showCents}
				/>
			}
			ListEmptyComponent={
				<Text className="py-3 text-muted text-subtitle">
					No spending in this period yet.
				</Text>
			}
			renderSectionHeader={({ section }) => (
				<DaySectionHeader
					section={section}
					showCents={showCents}
					first={sections[0] === section}
				/>
			)}
			renderItem={({ item }) => (
				<TransactionRow
					transaction={item}
					currency={currency}
					onPress={onPressTransaction}
					showCents={showCents}
					showSign={showSign}
				/>
			)}
		/>
	);
}

function BudgetSummary({
	period,
	spent,
	amount,
	leftover,
	overBudget,
	currency,
	paceRemaining,
	paceBehind,
	leftPerDayAmount,
	showCents,
}: {
	period: string;
	spent: number;
	amount: number;
	leftover: number;
	overBudget: boolean;
	currency: string;
	paceRemaining: number | null;
	paceBehind: boolean;
	leftPerDayAmount: number | null;
	showCents: boolean;
}) {
	const spentPct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
	const difference = Math.abs(leftover);
	const figureTone = overBudget ? "text-over-budget" : "text-foreground";
	const label = overBudget ? `over ${period}` : `left ${period}`;

	return (
		<View>
			<View className="flex-row items-baseline justify-between">
				<MonoLabel>{period}</MonoLabel>
				<MonoLabel>{`${spentPct}% spent`}</MonoLabel>
			</View>

			<View className="pt-2">
				<HeroNumber
					amount={difference}
					code={currency}
					sign=""
					toneClass={figureTone}
					size={48}
					showCents={showCents}
				/>
			</View>
			<Text className="pt-0.5 text-footnote text-muted">{label}</Text>
			{leftPerDayAmount != null ? (
				<Text
					className="pt-0.5 text-footnote text-muted"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{formatAmount(leftPerDayAmount, currency, showCents)} left each day
				</Text>
			) : null}

			<View className="pt-5" style={{ marginHorizontal: -RAIL_BLEED }}>
				<BudgetProgressBar
					spent={spent}
					limit={amount}
					paceRemaining={paceRemaining}
					paceBehind={paceBehind}
					height={8}
				/>
			</View>

			<View className="flex-row items-baseline justify-between pt-2.5">
				<MonoLabel>{`${formatAmount(spent, currency, showCents)} spent`}</MonoLabel>
				<MonoLabel>{`${formatAmount(amount, currency, showCents)} limit`}</MonoLabel>
			</View>

			<View className="pt-7">
				<MonoLabel>TRANSACTIONS</MonoLabel>
			</View>
		</View>
	);
}
