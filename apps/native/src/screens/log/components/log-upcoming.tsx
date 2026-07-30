import { useMemo } from "react";
import { View } from "react-native";

import { DayTotal } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { TransactionRow } from "@/components/transaction-row";
import { landingDate } from "@/data/log-filtered";
import type { TransactionWithCategory } from "@/data/transactions";
import { currencyTotals } from "@/domain/currency-totals";
import { monthlySubscriptionCost } from "@/domain/subscription-cost";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n";

interface LogUpcomingProps {
	transactions: TransactionWithCategory[];
	/**
	 * Every schedule, not only the ones `transactions` paints: the Log clips its
	 * rows to the next two weeks, and a monthly cost taken over that clip is a
	 * different number on the day a yearly renewal enters the window.
	 */
	schedules: TransactionWithCategory[];
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
	use24Hour: boolean;
	/** Frozen "now", so a row's landing date does not drift mid-session. */
	nowMs: number;
}

export function LogUpcoming({
	transactions,
	schedules,
	currency,
	rates,
	onPress,
	onLongPress,
	showCents,
	showSign,
	swapTimeLabel,
	use24Hour,
	nowMs,
}: LogUpcomingProps) {
	const now = new Date(nowMs);
	const t = useTranslation();
	const totals = useMemo(
		() => currencyTotals(transactions, currency, rates),
		[transactions, currency, rates],
	);
	// A second figure rather than a correction of the first: the heading total is
	// genuinely what leaves the account next, but each schedule contributes one
	// charge to it whatever its cadence, so alone it reads like a monthly cost
	// while weighing a daily coffee the same as a yearly renewal.
	const perMonth = useMemo(
		() => monthlySubscriptionCost(schedules, currency, rates, new Date(nowMs)),
		[schedules, currency, rates, nowMs],
	);
	const showPerMonth = perMonth.some((bucket) => bucket.transactionCount > 0);

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
				{showPerMonth ? (
					<View className="flex-row items-baseline justify-between gap-2">
						<MonoLabel>{t("log.upcoming.perMonth")}</MonoLabel>
						<DayTotal totals={perMonth} showCents={showCents} />
					</View>
				) : null}
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
					use24Hour={use24Hour}
					future
					landsOn={landingDate(transaction, now)}
				/>
			))}
		</View>
	);
}
