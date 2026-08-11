import type { MenuAction } from "@expo/ui/community/menu";
import { Stack, useRouter } from "expo-router";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { HeroNumber } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { type LedgerCell, LedgerHead } from "@/components/ledger-head";
import { MonoLabel } from "@/components/mono-label";
import { ScopeChip } from "@/components/scope-chip";
import { Text } from "@/components/text";
import { useDisplaySettings, useSettingBool, useSettingNumber } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	bucketDateLabel,
	type CategoryBreakdownEntry,
	type CategoryMeta,
	categoryBreakdownWithin,
	type InsightsBucket,
	type InsightsCalendar,
	type InsightsContribution,
	type InsightsMeasure,
	type InsightsPeriod,
	runningTotals,
	subcategoryBreakdown,
	subcategoryBreakdownWithin,
} from "@/data/insights";
import { useWindowTransactions } from "@/data/insights-transactions";
import { setNumberSetting } from "@/data/settings-core";
import { useSpendingCalendar } from "@/data/spending-calendar";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { type UseInsightsResult, useInsights } from "@/data/use-insights";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import {
	type InsightsTotals,
	insightsMeasureAlternatives,
	insightsMeasureFromStored,
	insightsMeasureIsIncome,
	insightsMeasureIsPositive,
	insightsMeasureMagnitude,
	netTotal,
	storedInsightsMeasure,
} from "@/domain/insights-measure";
import { quietAlternative } from "@/domain/insights-quiet";
import { insightsVerdict } from "@/domain/insights-verdict";
import { formatAmount } from "@/domain/money";
import type { TranslationKey } from "@/i18n/catalog";
import { type TranslateFn, useTranslation } from "@/i18n/context";
import { UndoToast } from "@/screens/log/components/undo-toast";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { CategoryBreakdownRow } from "./components/category-breakdown-row";
import { CategoryProportionBar } from "./components/category-proportion-bar";
import { InsightsBarChart } from "./components/insights-bar-chart";
import { InsightsMovers } from "./components/insights-movers";
import { InsightsNetChart } from "./components/insights-net-chart";
import { InsightsQuiet } from "./components/insights-quiet";
import { InsightsSample } from "./components/insights-sample";
import { InsightsTransactionList } from "./components/insights-transaction-list";
import { SpendingCalendar } from "./components/spending-calendar";
import { MEASURE_KEY } from "./measure-label";

const PERIOD_BY_VALUE: Record<number, InsightsPeriod> = {
	1: "week",
	2: "month",
	3: "year",
};

const PERIOD_OPTIONS: readonly { labelKey: TranslationKey; value: number }[] = [
	{ labelKey: "insights.period.week", value: 1 },
	{ labelKey: "insights.period.month", value: 2 },
	{ labelKey: "insights.period.year", value: 3 },
];

const PERIOD_LABEL_KEY: Record<InsightsPeriod, TranslationKey> = {
	month: "insights.period.month",
	week: "insights.period.week",
	year: "insights.period.year",
};

function heroMagnitudeFor(
	filteredEntry: CategoryBreakdownEntry | null,
	readBalance: number | null,
	readBucket: InsightsBucket | null,
	measure: InsightsMeasure,
	totals: InsightsTotals
): number {
	if (filteredEntry) {
		return filteredEntry.amount;
	}
	if (readBalance != null) {
		return Math.abs(readBalance);
	}
	if (readBucket) {
		return Math.abs(readBucket.value);
	}
	return insightsMeasureMagnitude(measure, totals);
}

function heroPositiveFor(
	readBalance: number | null,
	readBucket: InsightsBucket | null,
	isNet: boolean,
	measure: InsightsMeasure,
	totals: InsightsTotals
): boolean {
	if (readBalance != null) {
		return readBalance >= 0;
	}
	if (readBucket && isNet) {
		return readBucket.value >= 0;
	}
	return insightsMeasureIsPositive(measure, totals);
}

function bucketAt(buckets: readonly InsightsBucket[], index: number | null): InsightsBucket | null {
	if (index == null) {
		return null;
	}
	return buckets[index] ?? null;
}

function boundsOf(bucket: InsightsBucket): { end: number; start: number } {
	return { end: bucket.end.getTime(), start: bucket.start.getTime() };
}

function breakdownFor(
	windowBreakdown: CategoryBreakdownEntry[],
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	lockedBucket: InsightsBucket | null,
	measure: InsightsMeasure,
	nowMs: number
): CategoryBreakdownEntry[] {
	if (!lockedBucket) {
		return windowBreakdown;
	}
	return categoryBreakdownWithin(rows, categoriesById, measure, boundsOf(lockedBucket), new Date(nowMs));
}

function subBreakdownFor(
	rows: readonly InsightsContribution[],
	categoriesById: ReadonlyMap<string, CategoryMeta>,
	filterId: string | null,
	lockedBucket: InsightsBucket | null,
	period: InsightsPeriod,
	measure: InsightsMeasure,
	nowMs: number,
	offset: number,
	calendar: InsightsCalendar
): CategoryBreakdownEntry[] {
	if (filterId == null) {
		return [];
	}
	if (lockedBucket) {
		return subcategoryBreakdownWithin(rows, categoriesById, filterId, measure, boundsOf(lockedBucket), new Date(nowMs));
	}
	return subcategoryBreakdown(rows, categoriesById, filterId, period, measure, new Date(nowMs), offset, calendar);
}

/**
 * On the net chart the scrubbed figure is the running position, so a bare date
 * would read as that day's own net.
 */
function eyebrowLabel(
	scrubBucket: InsightsBucket | null,
	isNet: boolean,
	period: InsightsPeriod,
	measure: InsightsMeasure,
	windowLabel: string,
	t: TranslateFn
): string {
	if (!scrubBucket) {
		return `${t(MEASURE_KEY[measure])} · ${windowLabel}`;
	}
	const prefix = isNet ? `${t("insights.balance")} · ` : "";
	return `${prefix}${bucketDateLabel(period, scrubBucket.start)}`;
}

/** Null keeps both directions, which is what the net measure reads. */
function listDirection(measure: InsightsMeasure): boolean | null {
	if (measure === "income") {
		return true;
	}
	if (measure === "spent") {
		return false;
	}
	return null;
}

/** Null means nothing is selected, and the list below the chart stays closed. */
function windowQuery(
	lockedBucket: InsightsBucket | null,
	filterId: string | null,
	measure: InsightsMeasure,
	nowMs: number,
	windowStart: Date,
	windowEnd: Date
) {
	if (!(lockedBucket || filterId)) {
		return null;
	}
	return {
		categoryId: filterId,
		end: lockedBucket ? lockedBucket.end : windowEnd,
		income: listDirection(measure),
		nowMs,
		start: lockedBucket ? lockedBucket.start : windowStart,
	};
}

function verdictFor(
	result: UseInsightsResult,
	measure: InsightsMeasure,
	totals: InsightsTotals,
	code: string,
	showCents: boolean,
	t: TranslateFn
) {
	return insightsVerdict({
		code,
		current: measure === "net" ? netTotal(totals) : insightsMeasureMagnitude(measure, totals),
		measure,
		prior: measure === "net" ? result.priorNet : result.priorMeasure,
		priorLabel: result.priorLabel,
		showCents,
		t,
		topMover: result.movers[0] ?? null,
	});
}

function applyWindowAction(event: string, step: (direction: 1 | -1) => void, toNow: () => void): void {
	if (event === "earlier") {
		step(-1);
	} else if (event === "later") {
		step(1);
	} else if (event === "now") {
		toNow();
	}
}

function balanceAt(running: readonly number[], index: number | null, isNet: boolean): number | null {
	if (!isNet || index == null) {
		return null;
	}
	return running[index] ?? null;
}

export function Insights() {
	const db = useDatabase();
	return <InsightsContent db={db} />;
}

function InsightsContent({ db }: { db: Database }) {
	const t = useTranslation();
	const router = useRouter();
	const currency = useGlobalCurrency(db);
	const { showCents } = useDisplaySettings().state;
	const nowMs = useNow();

	const incomeTracking = useSettingBool("incomeTracking");
	const period = PERIOD_BY_VALUE[useSettingNumber("insightsTimeFrame")] ?? "week";

	// With income tracking off there is only one direction, so the measure is not
	// a choice.
	const stored = insightsMeasureFromStored(useSettingNumber("insightsMeasure"));
	const measure = incomeTracking ? stored : "spent";

	const firstWeekday = useSettingNumber("firstWeekday");
	const firstDayOfMonth = useSettingNumber("firstDayOfMonth");
	const calendar: InsightsCalendar = useMemo(
		() => ({ firstDayOfMonth, firstWeekday }),
		[firstWeekday, firstDayOfMonth]
	);

	const [offset, setOffset] = useState(0);
	const [lockedIndex, setLockedIndex] = useState<number | null>(null);
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);
	const [filterId, setFilterId] = useState<string | null>(null);

	const result = useInsights(db, nowMs, period, measure, offset, calendar);
	const spendingCalendar = useSpendingCalendar(db, nowMs);

	// Both selections name a bucket index and a category that may not survive the
	// window, period or measure changing.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset keys only
	useEffect(() => {
		setLockedIndex(null);
		setFilterId(null);
	}, [offset, period, measure]);

	const step = useCallback((direction: 1 | -1) => {
		setOffset((current) => (direction === 1 ? Math.min(0, current + 1) : current - 1));
	}, []);

	const selectPeriod = (value: number) => {
		setOffset(0);
		setNumberSetting(db, "insightsTimeFrame", value).catch((error: unknown) => {
			console.error("Saving the insights period failed", error);
		});
	};

	const promote = (next: typeof measure) => {
		setNumberSetting(db, "insightsMeasure", storedInsightsMeasure(next)).catch((error: unknown) => {
			console.error("Saving the insights measure failed", error);
		});
	};

	const lockedBucket = bucketAt(result.buckets, lockedIndex);
	const scrubBucket = bucketAt(result.buckets, scrubIndex);
	const readBucket = scrubBucket ?? lockedBucket;

	const breakdown = useMemo(
		() => breakdownFor(result.breakdown, result.rows, result.categoriesById, lockedBucket, measure, nowMs),
		[lockedBucket, result.breakdown, result.rows, result.categoriesById, measure, nowMs]
	);

	const filteredEntry = filterId ? (breakdown.find((entry) => entry.id === filterId) ?? null) : null;

	const subBreakdown = useMemo(
		() =>
			subBreakdownFor(
				result.rows,
				result.categoriesById,
				filterId,
				lockedBucket,
				period,
				measure,
				nowMs,
				offset,
				calendar
			),
		[filterId, lockedBucket, result.rows, result.categoriesById, period, measure, nowMs, offset, calendar]
	);

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
	const running = useMemo(() => (isNet ? runningTotals(result.buckets) : []), [isNet, result.buckets]);
	const readBalance = balanceAt(running, readIndex, isNet);

	// The hero follows the narrowest thing selected.
	const heroMagnitude = heroMagnitudeFor(filteredEntry, readBalance, readBucket, measure, totals);
	const heroPositive = heroPositiveFor(readBalance, readBucket, isNet, measure, totals);

	const eyebrow = eyebrowLabel(scrubBucket, isNet, period, measure, result.label, t);

	const verdict = verdictFor(result, measure, totals, currency, showCents, t);

	const windowActions: MenuAction[] = [
		{
			attributes: { disabled: result.atEarliest },
			id: "earlier",
			image: "chevron.left",
			title: t("insights.window.earlier"),
		},
		{
			attributes: { disabled: result.atCurrent },
			id: "later",
			image: "chevron.right",
			title: t("insights.window.later"),
		},
		{
			displayInline: true,
			id: "now-section",
			subactions: [
				{
					attributes: { disabled: result.atCurrent },
					id: "now",
					image: "arrow.uturn.backward",
					title: t("insights.window.now"),
				},
			],
			title: "",
		},
	];

	const onWindowAction = (event: string) => {
		applyWindowAction(event, step, () => setOffset(0));
	};

	const listQuery = useMemo(
		() => windowQuery(lockedBucket, filterId, measure, nowMs, result.start, result.end),
		[lockedBucket, filterId, measure, nowMs, result.start, result.end]
	);

	const listTransactions = useWindowTransactions(db, listQuery);
	// Held here, not in the list: clearing the chart selection unmounts the list,
	// and the hook flushes its pending write on unmount — so a delete owned down
	// there would commit the instant the row's own list went away, before the undo
	// window had run and before the toast offering it could be tapped.
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);
	// Only a single day reads better ungrouped — every row would share one header.
	const listGrouped = !(lockedBucket && period !== "year");

	const chart = (
		<ChartSlot
			average={result.measureAverage}
			buckets={result.buckets}
			code={currency}
			isEmpty={chartIsEmpty}
			measure={measure}
			nowMs={nowMs}
			onCommit={setLockedIndex}
			onScrub={setScrubIndex}
			period={period}
			quietAlt={quietAlt}
			running={running}
			selectedIndex={lockedIndex}
		/>
	);

	if (!result.hasHistory) {
		return <InsightsSample onAddTransaction={() => router.push("/transactions/create")} />;
	}

	return (
		<>
			<Stack.Toolbar placement="right">
				<Stack.Toolbar.Menu accessibilityLabel={t("insights.period.change")}>
					<Stack.Toolbar.Label>{t(PERIOD_LABEL_KEY[period])}</Stack.Toolbar.Label>
					{PERIOD_OPTIONS.map((option) => (
						<Stack.Toolbar.MenuAction
							isOn={PERIOD_BY_VALUE[option.value] === period}
							key={option.value}
							onPress={() => selectPeriod(option.value)}
						>
							{t(option.labelKey)}
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
							accessibilityLabel={t("insights.window.shown")}
							actions={windowActions}
							menuTitle={t("insights.window.title")}
							onAction={onWindowAction}
							title={result.label}
						/>
						{lockedBucket ? (
							<ScopeChip
								accessibilityLabel={t("insights.scope.selectedPeriod")}
								clearAccessibilityLabel={t("insights.scope.clearBar")}
								onClear={() => setLockedIndex(null)}
								title={bucketDateLabel(period, lockedBucket.start)}
							/>
						) : null}
						{filteredEntry ? (
							<ScopeChip
								accessibilityLabel={t("insights.scope.filteredCategory")}
								clearAccessibilityLabel={t("insights.scope.clearCategory")}
								onClear={() => setFilterId(null)}
								title={filteredEntry.name}
							/>
						) : null}
					</View>

					<View className="flex-row items-center gap-2 pt-3.5">
						<MonoLabel numberOfLines={1}>{eyebrow}</MonoLabel>
						<VerdictBadge badge={scoped ? null : verdict.badge} favourable={verdict.favourable} />
					</View>

					<View className="pt-0.5">
						<HeroNumber
							amount={heroMagnitude}
							code={currency}
							showCents={showCents}
							sign={heroPositive ? "+" : "-"}
							size={40}
							toneClass={insightsMeasureIsIncome(measure) ? "text-income" : "text-foreground"}
						/>
					</View>

					{!scoped && verdict.sentence ? (
						<Text className="pt-0.5 text-footnote text-muted">{verdict.sentence}</Text>
					) : null}

					{incomeTracking && !scoped ? (
						<View className="pt-3">
							<LedgerHead
								cells={insightsMeasureAlternatives(measure).map(
									(alternative): LedgerCell => ({
										income: insightsMeasureIsIncome(alternative),
										key: alternative,
										label: t(MEASURE_KEY[alternative]),
										magnitude: insightsMeasureMagnitude(alternative, totals),
										onPress: () => promote(alternative),
										positive: insightsMeasureIsPositive(alternative, totals),
									})
								)}
								code={currency}
							/>
						</View>
					) : null}

					<View className="pt-4">{chart}</View>

					{scoped ? null : (
						<View className="pt-6">
							<InsightsMovers code={currency} measure={measure} movers={result.movers} priorLabel={result.priorLabel} />
						</View>
					)}
				</View>

				<BreakdownSection
					code={currency}
					entries={breakdown}
					filterId={filterId}
					lockedBucket={lockedBucket}
					measure={measure}
					onFilter={setFilterId}
					period={period}
					showCents={showCents}
					subEntries={subBreakdown}
				/>

				<View className="px-5 pt-6">
					<SpendingCalendar
						currency={currency}
						entries={spendingCalendar}
						firstWeekday={firstWeekday}
						now={new Date(nowMs)}
						showCents={showCents}
					/>
				</View>

				{listQuery ? (
					<View className="px-5 pt-6">
						<InsightsTransactionList
							currency={currency}
							grouped={listGrouped}
							onPress={(id) => router.push(`/transactions/${id}`)}
							onRequestDelete={requestDelete}
							pendingDeleteId={pendingId}
							transactions={listTransactions}
						/>
					</View>
				) : null}
			</ScrollView>
			<UndoToast onUndo={undo} visible={pendingId != null} />
		</>
	);
}

function VerdictBadge({ badge, favourable }: { badge: string | null; favourable: boolean }) {
	const colors = useColors();
	if (!badge) {
		return null;
	}
	const tone = favourable ? colors.income : colors.danger;
	return (
		<View
			style={{
				backgroundColor: withAlpha(tone, 0.2),
				borderRadius: 6,
				paddingHorizontal: 5,
				paddingVertical: 2,
			}}
		>
			<Text className="font-sans-semibold text-footnote" style={{ color: tone }}>
				{badge}
			</Text>
		</View>
	);
}

interface ChartSlotProps {
	average: number;
	buckets: InsightsBucket[];
	code: string;
	isEmpty: boolean;
	measure: InsightsMeasure;
	nowMs: number;
	onCommit: Dispatch<SetStateAction<number | null>>;
	onScrub: Dispatch<SetStateAction<number | null>>;
	period: InsightsPeriod;
	quietAlt: InsightsMeasure | null;
	running: number[];
	selectedIndex: number | null;
}

function ChartSlot({
	average,
	buckets,
	code,
	isEmpty,
	measure,
	nowMs,
	onCommit,
	onScrub,
	period,
	quietAlt,
	running,
	selectedIndex,
}: ChartSlotProps): ReactNode {
	if (isEmpty) {
		return <InsightsQuiet alternative={quietAlt} measure={measure} period={period} />;
	}
	if (measure === "net") {
		return (
			<InsightsNetChart
				buckets={buckets}
				code={code}
				nowMs={nowMs}
				onCommit={onCommit}
				onScrub={onScrub}
				period={period}
				selectedIndex={selectedIndex}
				totals={running}
			/>
		);
	}
	return (
		<InsightsBarChart
			average={average}
			buckets={buckets}
			code={code}
			measure={measure}
			nowMs={nowMs}
			onCommit={onCommit}
			onScrub={onScrub}
			period={period}
			selectedIndex={selectedIndex}
		/>
	);
}

interface BreakdownSectionProps {
	code: string;
	entries: CategoryBreakdownEntry[];
	filterId: string | null;
	lockedBucket: InsightsBucket | null;
	measure: InsightsMeasure;
	onFilter: Dispatch<SetStateAction<string | null>>;
	period: InsightsPeriod;
	showCents: boolean;
	subEntries: CategoryBreakdownEntry[];
}

function BreakdownSection({
	code,
	entries,
	filterId,
	lockedBucket,
	measure,
	onFilter,
	period,
	showCents,
	subEntries,
}: BreakdownSectionProps) {
	const t = useTranslation();
	if (entries.length === 0) {
		return null;
	}
	const heading = lockedBucket
		? `${t("insights.categories")} · ${bucketDateLabel(period, lockedBucket.start)}`
		: t("insights.categories");

	return (
		<View className="px-5 pt-6">
			<View className="pb-3">
				<MonoLabel>{heading}</MonoLabel>
			</View>
			<View className="pb-1">
				<CategoryProportionBar entries={entries} onSelect={onFilter} selectedId={filterId} />
			</View>
			<View className="pt-2">
				{entries.map((entry) => (
					<View key={entry.id}>
						<CategoryBreakdownRow
							code={code}
							dimmed={filterId != null && filterId !== entry.id}
							entry={entry}
							measure={measure}
							onClear={() => onFilter(null)}
							onPress={() => onFilter((current) => (current === entry.id ? null : entry.id))}
							selected={filterId === entry.id}
							showCents={showCents}
						/>
						<SubBreakdown code={code} entries={filterId === entry.id ? subEntries : []} showCents={showCents} />
					</View>
				))}
			</View>
		</View>
	);
}

function SubBreakdown({
	code,
	entries,
	showCents,
}: {
	code: string;
	entries: CategoryBreakdownEntry[];
	showCents: boolean;
}) {
	if (entries.length === 0) {
		return null;
	}
	return (
		<View className="gap-2 pt-2 pb-3 pl-4">
			{entries.map((child) => (
				<ChildRow
					amount={child.amount}
					code={code}
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
	);
}

interface ChildRowProps {
	amount: number;
	code: string;
	color: string;
	emoji: string | null;
	fraction: number;
	icon: string | null;
	name: string;
	showCents: boolean;
}

function ChildRow({ name, color, icon, emoji, amount, fraction, code, showCents }: ChildRowProps) {
	return (
		<View className="flex-row items-center gap-2.5">
			<CategoryIconTile color={color} emoji={emoji} icon={icon} size={26} />
			<Text className="flex-1 font-sans-medium text-caption text-foreground" numberOfLines={1}>
				{name}
			</Text>
			<Text
				className="font-sans-medium text-caption text-muted"
				numberOfLines={1}
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{formatAmount(amount, code, showCents)}
			</Text>
			<Text className="font-mono text-label text-muted" style={{ minWidth: 34, textAlign: "right" }}>
				{Math.round(fraction * 100)}%
			</Text>
		</View>
	);
}
