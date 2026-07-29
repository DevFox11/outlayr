import { HugeiconsIcon } from "@hugeicons/react-native";
import { Archive02Icon } from "@hugeicons-pro/core-solid-rounded";
import { useMemo } from "react";
import { View } from "react-native";
import { DaySectionHeader } from "@/components/day-section-header";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { useValuation } from "@/data/use-valuation";
import { groupByDay } from "@/domain/day-sections";
import { useColors } from "@/theme/use-colors";

interface InsightsTransactionListProps {
	transactions: TransactionWithCategory[];
	currency: string;
	onPress: (id: string) => void;
	showCents?: boolean;
	showSign?: boolean;
	swapTimeLabel?: boolean;
	/** Break the list into day sections with their signed subtotals. */
	grouped?: boolean;
}

export function InsightsTransactionList({
	transactions,
	currency,
	onPress,
	showCents = true,
	showSign = true,
	swapTimeLabel = false,
	grouped = true,
}: InsightsTransactionListProps) {
	const { rates } = useValuation(useDatabase());
	const sections = useMemo(
		() => (grouped ? groupByDay(transactions, currency, rates) : []),
		[grouped, transactions, currency, rates],
	);

	if (transactions.length === 0) {
		return <InsightsNoResults />;
	}

	const row = (transaction: TransactionWithCategory) => (
		<TransactionRow
			currency={currency}
			key={transaction.id}
			onPress={onPress}
			showCents={showCents}
			showSign={showSign}
			swapTimeLabel={swapTimeLabel}
			transaction={transaction}
		/>
	);

	if (!grouped) {
		return <View>{transactions.map(row)}</View>;
	}

	return (
		<View>
			{sections.map((section, index) => (
				<View key={section.day.getTime()}>
					<DaySectionHeader
						first={index === 0}
						section={section}
						showCents={showCents}
					/>
					{section.data.map(row)}
				</View>
			))}
		</View>
	);
}

function InsightsNoResults() {
	const colors = useColors();
	return (
		<View className="items-center justify-center gap-3 py-12 opacity-70">
			<HugeiconsIcon color={colors.muted} icon={Archive02Icon} size={38} />
			<Text className="font-sans-medium text-muted text-title">
				No entries found.
			</Text>
		</View>
	);
}
