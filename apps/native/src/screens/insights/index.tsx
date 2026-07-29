import type { MenuAction } from "@expo/ui/community/menu";
import { Stack, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { type LedgerCell, LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { ScopeChip } from "@/components/scope-chip";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	bucketDateLabel,
	categoryBreakdownWithin,
	type InsightsCalendar,
	type InsightsPeriod,
	runningTotals,
	subcategoryBreakdown,
	subcategoryBreakdownWithin,
} from "@/data/insights";
import { useWindowTransactions } from "@/data/insights-transactions";
import { setNumberSetting, useAllSettings } from "@/data/settings";
import { useInsights } from "@/data/use-insights";
import type { Database } from "@/db/client";
import {
	INSIGHTS_MEASURE_WORD,
	insightsMeasureAlternatives,
	insightsMeasureFromStored,
	insightsMeasureIsIncome,
	insightsMeasureIsPositive,
	insightsMeasureMagnitude,
	netTotal,
	storedInsightsMeasure,
} from "@/domain/insights-measure";
import { insightsVerdict } from "@/domain/insights-verdict";
import { formatAmount } from "@/domain/money";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryBreakdownRow } from "./components/category-breakdown-row";
import { CategoryProportionBar } from "./components/category-proportion-bar";
import { InsightsBarChart } from "./components/insights-bar-chart";
import { InsightsMovers } from "./components/insights-movers";
import { InsightsNetChart } from "./components/insights-net-chart";
import { InsightsQuiet, quietAlternative } from "./components/insights-quiet";
import { InsightsSample } from "./components/insights-sample";
import { InsightsTransactionList } from "./components/insights-transaction-list";

const PERIOD_BY_VALUE: Record<number, InsightsPeriod> = {
	1: "week",
	2: "month",
	3: "year",
};

const PERIOD_OPTIONS: readonly { label: string; value: number }[] = [
	{ label: "Week", value: 1 },
	{ label: "Month", value: 2 },
	{ label: "Year", value: 3 },
];

const PERIOD_LABEL: Record<InsightsPeriod, string> = {
	week: "Week",
	month: "Month",
	year: "Year",
};

export default function InsightsScreen() {
	const db = useDatabase();
	return <InsightsContent db={db} />;
}

function InsightsContent({ db }: { db: Database }) {
	const colors = useColors();
	const router = useRouter();
	const currency = useGlobalCurrency(db);
	const settings = useAllSettings(db);
	const [nowMs] = useState(() => Date.now());

	const showCents = settings.bool("showCents");
	const showSign = settings.bool("showExpenseOrIncomeSign");
	const swapTimeLabel = settings.bool("swapTimeLabel");
	const incomeTracking = settings.bool("incomeTracking");
	const period =
		PERIOD_BY_VALUE[settings.number("insightsTimeFrame")] ?? "week";

	// With income tracking off there is only one direction, so the measure is not
	// a choice.
	const stored = insightsMeasureFromStored(settings.number("insightsMeasure"));
	const measure = incomeTracking ? stored : "spent";

	const calendar: InsightsCalendar = useMemo(
		() => ({
			firstWeekday: settings.number("firstWeekday"),
			firstDayOfMonth: settings.number("firstDayOfMonth"),
		}),
		[settings],
	);

	const [offset, setOffset] = useState(0);
	const [lockedIndex, setLockedIndex] = useState<number | null>(null);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);
	const [filterId, setFilterId] = useState<string | null>(null);

	const result = useInsights(db, nowMs, period, measure, offset, calendar);

	// Both selections name a bucket index and a category that may not survive the
	// window, period or measure changing.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset keys only
	useEffect(() => {
		setLockedIndex(null);
		setFilterId(null);
	}, [offset, period, measure]);

	const step = useCallback((direction: 1 | -1) => {
		setOffset((current) =>
			direction === 1 ? Math.min(0, current + 1) : current - 1,
		);
	}, []);

	const selectPeriod = (value: number) => {
		setOffset(0);
		void setNumberSetting(db, "insightsTimeFrame", value);
	};

	const promote = (next: typeof measure) => {
		void setNumberSetting(db, "insightsMeasure", storedInsightsMeasure(next));
	};

	const lockedBucket =
		lockedIndex != null ? (result.buckets[lockedIndex] ?? null) : null;
	const scrubBucket =
		scrubIndex != null ? (result.buckets[scrubIndex] ?? null) : null;
	const readBucket = scrubBucket ?? lockedBucket;

	const breakdown = useMemo(() => {
		if (!lockedBucket) {
			return result.breakdown;
		}
		return categoryBreakdownWithin(
			result.rows,
			result.categoriesById,
			measure,
			{
				start: lockedBucket.start.getTime(),
				end: lockedBucket.end.getTime(),
			},
			new Date(nowMs),
		);
	}, [
		lockedBucket,
		result.breakdown,
		result.rows,
		result.categoriesById,
		measure,
		nowMs,
	]);

	const filteredEntry = filterId
		? (breakdown.find((entry) => entry.id === filterId) ?? null)
		: null;

	const subBreakdown = useMemo(() => {
		if (filterId == null) {
			return [];
		}
		if (lockedBucket) {
			return subcategoryBreakdownWithin(
				result.rows,
				result.categoriesById,
				filterId,
				measure,
				{
					start: lockedBucket.start.getTime(),
					end: lockedBucket.end.getTime(),
				},
				new Date(nowMs),
			);
		}
		return subcategoryBreakdown(
			result.rows,
			result.categoriesById,
			filterId,
			period,
			measure,
			new Date(nowMs),
			offset,
			calendar,
		);
	}, [
		filterId,
		lockedBucket,
		result.rows,
		result.categoriesById,
		period,
		measure,
		nowMs,
		offset,
		calendar,
	]);

	const totals = { income: result.income, spent: result.spent };
	const scoped = readBucket != null || filteredEntry != null;

	// Every slot at zero is not an empty ledger — the window may be busy in the
	// other direction.
	const chartIsEmpty = result.buckets.every((bucket) => bucket.value === 0);
	const quietAlt = chartIsEmpty ? quietAlternative(measure, totals) : null;

	const isNet = measure === "net";
	const readIndex = scrubIndex ?? lockedIndex;
	// Net is charted as a running balance, so a slot's reading is the balance at
	// that point, not the slot's own flow — see `runningTotals`.
	const running = useMemo(
		() => (isNet ? runningTotals(result.buckets) : []),
		[isNet, result.buckets],
	);
	const readBalance =
		isNet && readIndex != null ? (running[readIndex] ?? null) : null;

	// The hero follows the narrowest thing selected.
	let heroMagnitude: number;
	if (filteredEntry) {
		heroMagnitude = filteredEntry.amount;
	} else if (readBalance != null) {
		heroMagnitude = Math.abs(readBalance);
	} else if (readBucket) {
		heroMagnitude = Math.abs(readBucket.value);
	} else {
		heroMagnitude = insightsMeasureMagnitude(measure, totals);
	}

	let heroPositive: boolean;
	if (readBalance != null) {
		heroPositive = readBalance >= 0;
	} else if (readBucket && isNet) {
		heroPositive = readBucket.value >= 0;
	} else {
		heroPositive = insightsMeasureIsPositive(measure, totals);
	}

	// On the net chart the scrubbed figure is the running position, so a bare date
	// would read as that day's own net.
	const eyebrow = scrubBucket
		? `${isNet ? "Balance · " : ""}${bucketDateLabel(period, scrubBucket.start)}`
		: `${INSIGHTS_MEASURE_WORD[measure]} · ${result.label}`;

	const verdict = insightsVerdict({
		measure,
		current:
			measure === "net"
				? netTotal(totals)
				: insightsMeasureMagnitude(measure, totals),
		prior: measure === "net" ? result.priorNet : result.priorMeasure,
		priorLabel: result.priorLabel,
		topMover: result.movers[0] ?? null,
		code: currency,
		showCents,
	});

	const windowActions: MenuAction[] = [
		{
			id: "earlier",
			title: "Earlier",
			image: "chevron.left",
			attributes: { disabled: result.atEarliest },
		},
		{
			id: "later",
			title: "Later",
			image: "chevron.right",
			attributes: { disabled: result.atCurrent },
		},
		{
			id: "now-section",
			title: "",
			displayInline: true,
			subactions: [
				{
					id: "now",
					title: "Now",
					image: "arrow.uturn.backward",
					attributes: { disabled: result.atCurrent },
				},
			],
		},
	];

	const onWindowAction = (event: string) => {
		if (event === "earlier") {
			step(-1);
		} else if (event === "later") {
			step(1);
		} else if (event === "now") {
			setOffset(0);
		}
	};

	const listQuery = useMemo(() => {
		if (!(lockedBucket || filterId)) {
			return null;
		}
		const direction =
			measure === "income" ? true : measure === "spent" ? false : null;
		return {
			start: lockedBucket ? lockedBucket.start : result.start,
			end: lockedBucket ? lockedBucket.end : result.end,
			nowMs,
			income: direction,
			categoryId: filterId,
		};
	}, [lockedBucket, filterId, measure, nowMs, result.start, result.end]);

	const listTransactions = useWindowTransactions(db, listQuery);
	// Only a single day reads better ungrouped — every row would share one header.
	const listGrouped = !(lockedBucket && period !== "year");

	let chart: ReactNode;
	if (chartIsEmpty) {
		chart = (
			<InsightsQuiet alternative={quietAlt} measure={measure} period={period} />
		);
	} else if (isNet) {
		chart = (
			<InsightsNetChart
				buckets={result.buckets}
				code={currency}
				nowMs={nowMs}
				onCommit={setLockedIndex}
				onScrub={setScrubIndex}
				period={period}
				selectedIndex={lockedIndex}
				totals={running}
			/>
		);
	} else {
		chart = (
			<InsightsBarChart
				average={result.measureAverage}
				buckets={result.buckets}
				code={currency}
				measure={measure}
				nowMs={nowMs}
				onCommit={setLockedIndex}
				onScrub={setScrubIndex}
				period={period}
				selectedIndex={lockedIndex}
			/>
		);
	}

	if (!result.hasHistory) {
		return (
			<InsightsSample
				onAddTransaction={() => router.push("/transaction/new")}
			/>
		);
	}

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu accessibilityLabel="Change period">
					<Stack.Toolbar.Label>{PERIOD_LABEL[period]}</Stack.Toolbar.Label>
					{PERIOD_OPTIONS.map((option) => (
						<Stack.Toolbar.MenuAction
							isOn={PERIOD_BY_VALUE[option.value] === period}
							key={option.value}
							onPress={() => selectPeriod(option.value)}
						>
							{option.label}
						</Stack.Toolbar.MenuAction>
					))}
				</Stack.Toolbar.Menu>
			</Stack.Toolbar>

			<ScrollView
				className="bg-background"
				contentContainerClassName="pb-4"
				contentInsetAdjustmentBehavior="automatic"
				showsVerticalScrollIndicator={false}
			>
				<View className="px-5">
					<View className="flex-row flex-wrap gap-2">
						<ScopeChip
							accessibilityLabel="Window shown"
							actions={windowActions}
							menuTitle="Window"
							onAction={onWindowAction}
							title={result.label}
						/>
						{lockedBucket ? (
							<ScopeChip
								accessibilityLabel="Selected period"
								clearAccessibilityLabel="Clear the selected bar"
								onClear={() => setLockedIndex(null)}
								title={bucketDateLabel(period, lockedBucket.start)}
							/>
						) : null}
						{filteredEntry ? (
							<ScopeChip
								accessibilityLabel="Filtered category"
								clearAccessibilityLabel="Clear the category filter"
								onClear={() => setFilterId(null)}
								title={filteredEntry.name}
							/>
						) : null}
					</View>

					<View className="flex-row items-center gap-2 pt-3.5">
						<MonoLabel numberOfLines={1}>{eyebrow}</MonoLabel>
						{!scoped && verdict.badge ? (
							<View
								style={{
									borderRadius: 6,
									paddingHorizontal: 5,
									paddingVertical: 2,
									backgroundColor: withAlpha(
										verdict.favourable ? colors.income : colors.danger,
										0.2,
									),
								}}
							>
								<Text
									className="font-sans-semibold text-footnote"
									style={{
										color: verdict.favourable ? colors.income : colors.danger,
									}}
								>
									{verdict.badge}
								</Text>
							</View>
						) : null}
					</View>

					<View className="pt-0.5">
						<HeroNumber
							amount={heroMagnitude}
							code={currency}
							showCents={showCents}
							sign={heroPositive ? "+" : "-"}
							size={40}
							toneClass={
								insightsMeasureIsIncome(measure)
									? "text-income"
									: "text-foreground"
							}
						/>
					</View>

					{!scoped && verdict.sentence ? (
						<Text className="pt-0.5 text-footnote text-muted">
							{verdict.sentence}
						</Text>
					) : null}

					{incomeTracking && !scoped ? (
						<View className="pt-3">
							<LedgerHead
								cells={insightsMeasureAlternatives(measure).map(
									(alternative): LedgerCell => ({
										key: alternative,
										label: INSIGHTS_MEASURE_WORD[alternative],
										magnitude: insightsMeasureMagnitude(alternative, totals),
										positive: insightsMeasureIsPositive(alternative, totals),
										income: insightsMeasureIsIncome(alternative),
										onPress: () => promote(alternative),
									}),
								)}
								code={currency}
								showCents={showCents}
							/>
						</View>
					) : null}

					<View className="pt-4">{chart}</View>

					{!scoped ? (
						<View className="pt-6">
							<InsightsMovers
								code={currency}
								measure={measure}
								movers={result.movers}
								priorLabel={result.priorLabel}
								showCents={showCents}
							/>
						</View>
					) : null}
				</View>

				{breakdown.length > 0 ? (
					<View className="px-5 pt-6">
						<View className="pb-3">
							<MonoLabel>
								{lockedBucket
									? `Categories · ${bucketDateLabel(period, lockedBucket.start)}`
									: "Categories"}
							</MonoLabel>
						</View>
						<View className="pb-1">
							<CategoryProportionBar
								entries={breakdown}
								onSelect={setFilterId}
								selectedId={filterId}
							/>
						</View>
						<View className="pt-2">
							{breakdown.map((entry) => (
								<View key={entry.id}>
									<CategoryBreakdownRow
										code={currency}
										dimmed={filterId != null && filterId !== entry.id}
										entry={entry}
										measure={measure}
										onClear={() => setFilterId(null)}
										onPress={() =>
											setFilterId((current) =>
												current === entry.id ? null : entry.id,
											)
										}
										selected={filterId === entry.id}
										showCents={showCents}
									/>
									{filterId === entry.id && subBreakdown.length > 0 ? (
										<View className="gap-2 pt-2 pb-3 pl-4">
											{subBreakdown.map((child) => (
												<ChildRow
													amount={child.amount}
													code={currency}
													color={child.color}
													emoji={child.emoji}
													fraction={child.fraction}
													icon={child.icon}
													key={child.id}
													name={child.name}
													showCents={showCents}
												/>
											))}
										</View>
									) : null}
								</View>
							))}
						</View>
					</View>
				) : null}

				{listQuery ? (
					<View className="px-5 pt-6">
						<InsightsTransactionList
							currency={currency}
							grouped={listGrouped}
							onPress={(id) => router.push(`/transaction/${id}`)}
							showCents={showCents}
							showSign={showSign}
							swapTimeLabel={swapTimeLabel}
							transactions={listTransactions}
						/>
					</View>
				) : null}
			</ScrollView>
		</>
	);
}

interface ChildRowProps {
	name: string;
	color: string;
	icon: string | null;
	emoji: string | null;
	amount: number;
	fraction: number;
	code: string;
	showCents: boolean;
}

function ChildRow({
	name,
	color,
	icon,
	emoji,
	amount,
	fraction,
	code,
	showCents,
}: ChildRowProps) {
	return (
		<View className="flex-row items-center gap-2.5">
			<CategoryIconTile color={color} emoji={emoji} icon={icon} size={26} />
			<Text
				className="flex-1 font-sans-medium text-caption text-foreground"
				numberOfLines={1}
			>
				{name}
			</Text>
			<Text
				className="font-sans-medium text-caption text-muted"
				numberOfLines={1}
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{formatAmount(amount, code, showCents)}
			</Text>
			<Text
				className="font-mono text-label text-muted"
				style={{ minWidth: 34, textAlign: "right" }}
			>
				{Math.round(fraction * 100)}%
			</Text>
		</View>
	);
}
