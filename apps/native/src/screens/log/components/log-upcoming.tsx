import { useMemo } from "react";
import { View } from "react-native";

import { DayTotal } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { TransactionRow } from "@/components/transaction-row";
import { landingDate } from "@/data/log-filtered";
import type { TransactionWithCategory } from "@/data/transactions";
import { currencyTotals } from "@/domain/currency-totals";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n";

interface LogUpcomingProps {
	transactions: TransactionWithCategory[];
	currency: string;
	/**
	 * Supplied rather than looked up, so the header converts against the same
	 * currency the caller is displaying. A screen with its own currency would
	 * otherwise get totals valued against the ledger-wide one.
	 */
	rates: RateTable;
	onPress: (id: string) => void;
	onLongPress: (id: string) => void;
	showCents: boolean;
	showSign: boolean;
	swapTimeLabel: boolean;
	/** Frozen "now", so a row's landing date does not drift mid-session. */
	nowMs: number;
}

export function LogUpcoming({
	transactions,
	currency,
	rates,
	onPress,
	onLongPress,
	showCents,
	showSign,
	swapTimeLabel,
	nowMs,
}: LogUpcomingProps) {
	const now = new Date(nowMs);
	const t = useTranslation();
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
					<MonoLabel>{t("log.upcoming.heading")}</MonoLabel>
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
					rates={rates}
					onPress={onPress}
					onLongPress={onLongPress}
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
