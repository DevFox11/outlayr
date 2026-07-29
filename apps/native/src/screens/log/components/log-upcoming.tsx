import { useMemo } from "react";
import { View } from "react-native";

import { DayTotal } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import { landingDate } from "@/data/log-filtered";
import type { TransactionWithCategory } from "@/data/transactions";
import { useValuation } from "@/data/use-valuation";
import { currencyTotals } from "@/domain/currency-totals";

interface LogUpcomingProps {
	transactions: TransactionWithCategory[];
	currency: string;
	onPress: (id: string) => void;
	showCents: boolean;
	showSign: boolean;
	swapTimeLabel: boolean;
	/** Frozen "now", so a row's landing date does not drift mid-session. */
	nowMs: number;
}

export function LogUpcoming({
	transactions,
	currency,
	onPress,
	showCents,
	showSign,
	swapTimeLabel,
	nowMs,
}: LogUpcomingProps) {
	const now = new Date(nowMs);
	const { rates } = useValuation(useDatabase());
	const totals = useMemo(
		() => currencyTotals(transactions, currency, rates),
		[transactions, currency, rates],
	);

	if (transactions.length === 0) {
		return null;
	}

	return (
		<View className="pb-4.5">
			<View className="gap-1.25 pt-2.5">
				<View className="flex-row items-baseline justify-between gap-2">
					<MonoLabel>UPCOMING</MonoLabel>
					<DayTotal
						totals={totals}
						showCents={showCents}
						sizeClass="text-body"
					/>
				</View>
				<View
					className="bg-border"
					style={{ height: 1.3, borderRadius: 0.65 }}
				/>
			</View>
			{transactions.map((transaction) => (
				<TransactionRow
					key={transaction.id}
					transaction={transaction}
					currency={currency}
					onPress={onPress}
					showCents={showCents}
					showSign={showSign}
					swapTimeLabel={swapTimeLabel}
					future
					landsOn={landingDate(transaction, now)}
				/>
			))}
		</View>
	);
}
