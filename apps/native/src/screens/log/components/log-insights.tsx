import MenuView from "@expo/ui/community/menu";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowDown01Icon } from "@hugeicons-pro/core-solid-rounded";
import { View } from "react-native";

import { type LedgerCell, LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type {
	LogInsights as LogInsightsData,
	LogPeriod,
} from "@/data/log-totals";
import {
	type LogFigures,
	type LogMeasure,
	measureAlternatives,
	measureIsIncome,
	measureIsPositive,
	measureMagnitude,
} from "@/domain/log-measure";
import type { SparklinePoint } from "@/domain/log-sparkline";
import { amountParts } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { MEASURE_WORD_KEY, PERIOD_PHRASE_KEY } from "../labels";
import { LogHeroNumber } from "./log-hero-number";
import { LogSparkline } from "./log-sparkline";

interface LogInsightsProps {
	insights: LogInsightsData;
	measure: LogMeasure;
	onMeasure: (measure: LogMeasure) => void;
	period: LogPeriod;
	/** The currency the whole screen is being read in. */
	displayCurrency: string;
	/** What the chip offers, ledger currency first — see `logCurrencyOptions`. */
	currencyOptions: readonly string[];
	/** Null puts the screen back in the ledger's own currency. */
	onDisplayCurrency: (code: string | null) => void;
	/**
	 * Opens the screen that curates favourites. Without a route in from here, a
	 * ledger kept in one currency offers a single option and the chip is a control
	 * that cannot do anything.
	 */
	onManageCurrencies: () => void;
	showCents: boolean;
	sparkline?: SparklineData | null;
}

export interface SparklineData {
	points: SparklinePoint[];
	positive: boolean;
	range: number;
	byMonth: boolean;
}

/**
 * Nothing here does currency arithmetic — `useLogInsights` buckets, and this
 * picks a bucket and renders it.
 */
export function LogInsights({
	insights,
	measure,
	onMeasure,
	period,
	displayCurrency,
	currencyOptions,
	onDisplayCurrency,
	onManageCurrencies,
	showCents,
	sparkline = null,
}: LogInsightsProps) {
	const t = useTranslation();
	// The buckets are already expressed in `displayCurrency`; it only fails to
	// name one when nothing in the period could be placed there.
	const figures =
		insights.perCurrency.find((f) => f.currencyCode === displayCurrency) ??
		insights.dominant;
	const alsoThisPeriod = insights.perCurrency.filter(
		(f) => f.currencyCode !== figures.currencyCode,
	);
	const alternatives = measureAlternatives(measure);

	return (
		<View className="pt-3.5 pb-1.5">
			<View className="flex-row items-baseline gap-2.5">
				<MonoLabel>
					{`${t(MEASURE_WORD_KEY[measure])} · ${t(PERIOD_PHRASE_KEY[period])}`}
				</MonoLabel>
				<View className="flex-1" />
				<DisplayCurrencyChip
					// The figures' own currency, not the requested one: when nothing in
					// the period could be placed in `displayCurrency` the numbers fall
					// back to the dominant bucket, and a chip still naming the request
					// would label the screen as something it is not.
					code={figures.currencyCode}
					options={currencyOptions}
					onSelect={(code) =>
						// The list leads with the ledger's own currency, so choosing it is
						// the way out of an override rather than an override onto itself.
						onDisplayCurrency(code === currencyOptions[0] ? null : code)
					}
					onManage={onManageCurrencies}
				/>
			</View>

			<View className="pt-1">
				<LogHeroNumber
					magnitude={measureMagnitude(measure, figures)}
					code={figures.currencyCode}
					positive={measureIsPositive(measure, figures)}
					showCents={showCents}
				/>
			</View>

			<View className="pt-3">
				<LedgerHead
					cells={alternatives.map(
						(alternative): LedgerCell => ({
							key: alternative,
							label: t(MEASURE_WORD_KEY[alternative]),
							magnitude: measureMagnitude(alternative, figures),
							positive: measureIsPositive(alternative, figures),
							income: measureIsIncome(alternative),
							onPress: () => onMeasure(alternative),
						}),
					)}
					code={figures.currencyCode}
					showCents={showCents}
				/>
			</View>

			{alsoThisPeriod.length > 0 ? (
				<View className="gap-2 pt-3">
					<View className="pb-0.75">
						<Hairline />
					</View>
					<MonoLabel>
						{t("log.insights.also", { period: t(PERIOD_PHRASE_KEY[period]) })}
					</MonoLabel>
					<View className="flex-row flex-wrap gap-1.5">
						{alsoThisPeriod.map((entry) => (
							<AlsoPill
								key={entry.currencyCode}
								figures={entry}
								measure={measure}
								showCents={showCents}
							/>
						))}
					</View>
				</View>
			) : null}

			{sparkline && sparkline.points.length > 1 ? (
				<LogSparkline
					points={sparkline.points}
					positive={sparkline.positive}
					range={sparkline.range}
					byMonth={sparkline.byMonth}
					measure={measure}
				/>
			) : null}
		</View>
	);
}

function Hairline() {
	return <View className="h-px w-full bg-border" />;
}

function AlsoPill({
	figures,
	measure,
	showCents,
}: {
	figures: LogFigures;
	measure: LogMeasure;
	showCents: boolean;
}) {
	const parts = amountParts(
		measureMagnitude(measure, figures),
		figures.currencyCode,
		showCents,
	);
	const amount = `${measureIsPositive(measure, figures) ? "+" : "-"}${
		parts.symbol
	}${parts.integer}${parts.fraction ? `.${parts.fraction}` : ""}`;

	return (
		<View
			className="flex-row items-center gap-1.5 rounded-[7px] bg-surface-secondary px-2 py-1"
			accessible
			accessibilityLabel={`${figures.currencyCode}, ${amount}`}
		>
			<MonoLabel>{figures.currencyCode}</MonoLabel>
			<Text
				className={cn(
					"font-sans-semibold text-footnote",
					measureIsIncome(measure) ? "text-income" : "text-foreground",
				)}
				style={{ fontVariant: ["tabular-nums"] }}
				numberOfLines={1}
			>
				{amount}
			</Text>
		</View>
	);
}

/**
 * Namespaced so it cannot collide with a currency code, which is what every
 * other action in this menu is identified by.
 */
const MANAGE_CURRENCIES_ACTION = "log.currency.manage";

function DisplayCurrencyChip({
	code,
	options,
	onSelect,
	onManage,
}: {
	code: string;
	options: readonly string[];
	onSelect: (code: string) => void;
	onManage: () => void;
}) {
	const t = useTranslation();
	return (
		<MenuView
			title={t("log.insights.currency")}
			actions={[
				...options.map((option) => ({
					id: option,
					title: option,
					state: (option === code ? "on" : "off") as "on" | "off",
				})),
				{
					id: MANAGE_CURRENCIES_ACTION,
					title: t("log.insights.currencyManage"),
				},
			]}
			onPressAction={({ nativeEvent }) => {
				if (nativeEvent.event === MANAGE_CURRENCIES_ACTION) {
					onManage();
					return;
				}
				onSelect(nativeEvent.event);
			}}
			shouldOpenOnLongPress={false}
		>
			<View
				className="flex-row items-center gap-1 rounded-full bg-surface-secondary px-2.25 py-1"
				accessibilityRole="button"
				accessibilityLabel={t("log.insights.currencyShown")}
				accessibilityValue={{ text: code }}
			>
				<MonoLabel className="text-foreground">{code}</MonoLabel>
				<HugeiconsIcon icon={ArrowDown01Icon} size={10} color="#767676" />
			</View>
		</MenuView>
	);
}
