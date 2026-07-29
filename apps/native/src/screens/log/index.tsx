import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SectionList } from "react-native";

import { DaySectionHeader } from "@/components/day-section-header";
import { FloatingAddButton } from "@/components/floating-add-button";
import { useDatabase } from "@/contexts/local-data-context";
import { useCategoryMeta } from "@/data/categories";
import {
	useFilteredTransactions,
	useUpcomingTransactions,
} from "@/data/log-filtered";
import {
	type LogPeriod,
	logPeriodFromStored,
	storedLogPeriod,
	useLogInsights,
	useSparklineRows,
} from "@/data/log-totals";
import { setNumberSetting, useAllSettings } from "@/data/settings";
import { LOG_PAGE_DAYS, useLoggedTransactions } from "@/data/transactions";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useValuation } from "@/data/use-valuation";
import type { Database } from "@/db/client";
import { addDays, addMonths, startOfDay } from "@/domain/dates";
import { groupByDay } from "@/domain/day-sections";
import type { LogFilter } from "@/domain/log-filter";
import { filterDetail } from "@/domain/log-filter";
import {
	type LogMeasure,
	logMeasureFromStored,
	storedLogMeasure,
} from "@/domain/log-measure";
import { cursorStart } from "@/domain/log-period-cursor";
import {
	sparklineIsPositive,
	sparklineRange,
	sparklineSeries,
} from "@/domain/log-sparkline";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { LogEmptyState } from "./components/log-empty-state";
import { LogFilterChip } from "./components/log-filter-chip";
import type { SparklineData } from "./components/log-insights";
import { LogInsights } from "./components/log-insights";
import { LogNoResults } from "./components/log-no-results";
import { LogToolbar } from "./components/log-toolbar";
import { LogUpcoming } from "./components/log-upcoming";
import { SwipeableTransactionRow } from "./components/swipeable-transaction-row";
import { UndoToast } from "./components/undo-toast";

export default function LogScreen() {
	const db = useDatabase();
	return <LogContent db={db} />;
}

/**
 * Kept out of `LogInsights` so that component stays presentational and the
 * (possibly whole-table) read happens in one place.
 */
function useSparkline(
	db: Database,
	nowMs: number,
	enabled: boolean,
	measure: LogMeasure,
	period: LogPeriod,
	firstWeekday: number,
): SparklineData | null {
	const today = startOfDay(new Date(nowMs));
	const floor = period === "month" ? addMonths(today, -1) : addDays(today, -7);
	const rows = useSparklineRows(
		db,
		nowMs,
		enabled && period !== "all",
		measure === "net",
		// A year is sampled monthly over twelve months, which the daily floor
		// would cut short.
		period === "year" ? null : floor,
	);

	return useMemo(() => {
		if (!enabled || period === "all") {
			return null;
		}
		const now = new Date(nowMs);
		const points = sparklineSeries(rows, measure, period, now);
		return {
			points,
			positive: sparklineIsPositive(measure, points),
			range: sparklineRange(period, now, firstWeekday),
			byMonth: period === "year",
		};
	}, [rows, measure, period, firstWeekday, enabled, nowMs]);
}

function LogContent({ db }: { db: Database }) {
	const router = useRouter();
	const { displayCurrency: currency, rates } = useValuation(db);
	// Every preference off one subscription: a per-key hook would register a
	// separate `appMeta` listener each, and each fires on any write to the table.
	const settings = useAllSettings(db);
	const showCents = settings.bool("showCents");
	const showSign = settings.bool("showExpenseOrIncomeSign");
	const swapTimeLabel = settings.bool("swapTimeLabel");
	const showUpcoming = settings.bool("showUpcoming");
	const firstWeekday = settings.number("firstWeekday");
	const period = logPeriodFromStored(settings.number("logInsightsTimeFrame"));
	const measure = logMeasureFromStored(settings.number("logInsightsType"));
	const [nowMs] = useState(() => Date.now());

	// Null means "whichever currency the period leads with". A scope is only
	// pinned by choosing one, and the pin lapses once that currency stops
	// appearing in the period.
	const [scopeCurrency, setScopeCurrency] = useState<string | null>(null);
	const [filter, setFilter] = useState<LogFilter>("all");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [income, setIncome] = useState(false);
	// One cursor per period unit, so switching between them leaves each where it was.
	const [cursors, setCursors] = useState<Record<string, Date>>(() => ({
		day: new Date(nowMs),
		week: new Date(nowMs),
		month: new Date(nowMs),
	}));

	const [days, setDays] = useState(LOG_PAGE_DAYS);

	const categoryMeta = useCategoryMeta(db);
	const filterableCategories = useMemo(
		() =>
			[...categoryMeta]
				.filter(([, meta]) => meta.parentId == null)
				.map(([id, meta]) => ({ id, meta })),
		[categoryMeta],
	);
	const activeCategoryId = categoryId ?? filterableCategories[0]?.id ?? null;

	const cursorUnit = filter === "week" || filter === "month" ? filter : "day";
	const cursor = cursors[cursorUnit] ?? new Date(nowMs);

	const { rows: windowRows, reachedEnd } = useLoggedTransactions(
		db,
		nowMs,
		days,
	);
	const filteredRows = useFilteredTransactions(db, nowMs, {
		filter,
		categoryId: activeCategoryId,
		cursor,
		income,
		firstWeekday,
	});
	const upcoming = useUpcomingTransactions(
		db,
		nowMs,
		settings.bool("showUpcomingSoon"),
	);
	const insights = useLogInsights(db, nowMs, period, currency, rates);
	const sparkline = useSparkline(
		db,
		nowMs,
		settings.bool("logViewLineGraph"),
		measure,
		period,
		firstWeekday,
	);
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);

	const listRows = filter === "all" ? windowRows : filteredRows;
	const sections = useMemo(
		() =>
			groupByDay(
				listRows.filter((row) => row.id !== pendingId),
				currency,
				rates,
			),
		[listRows, pendingId, currency, rates],
	);

	const openRowActions = useTransactionRowActions(db, nowMs, requestDelete);

	const detail = filterDetail(filter, {
		categoryName: activeCategoryId
			? categoryMeta.get(activeCategoryId)?.name
			: null,
		cursor,
		income,
		firstWeekday,
	});

	const showUpcomingSection =
		filter === "upcoming" || (filter === "all" && showUpcoming);
	const upcomingRows = showUpcomingSection ? upcoming : [];
	const emptyResult =
		sections.length === 0 &&
		(filter !== "upcoming" || upcomingRows.length === 0);

	const toolbar = (
		<LogToolbar
			period={period}
			onPeriod={(next) => {
				setNumberSetting(db, "logInsightsTimeFrame", storedLogPeriod(next));
			}}
			filter={filter}
			onFilter={setFilter}
			onSearch={() => router.push("/search")}
		/>
	);

	if (windowRows.length === 0 && filter === "all") {
		return (
			<>
				<LogEmptyState />
				<FloatingAddButton />
			</>
		);
	}

	return (
		<>
			{toolbar}
			<SectionList
				className="bg-background"
				contentInsetAdjustmentBehavior="automatic"
				sections={filter === "upcoming" ? [] : sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled={false}
				onEndReachedThreshold={0.5}
				onEndReached={() => {
					if (filter === "all" && !reachedEnd) {
						setDays((current) => current + LOG_PAGE_DAYS);
					}
				}}
				contentContainerStyle={{
					paddingHorizontal: 20,
					// `NativeTabs` supplies the bar + safe-area inset; this only clears
					// the floating add button.
					paddingBottom: 100,
					flexGrow: 1,
				}}
				ListHeaderComponent={
					<>
						{filter === "all" ? (
							<LogInsights
								insights={insights}
								measure={measure}
								onMeasure={(next: LogMeasure) => {
									setNumberSetting(
										db,
										"logInsightsType",
										storedLogMeasure(next),
									);
								}}
								period={period}
								scopeCurrency={scopeCurrency}
								onScopeCurrency={setScopeCurrency}
								showCents={showCents}
								sparkline={sparkline}
							/>
						) : (
							<LogFilterChip
								filter={filter}
								detail={detail}
								categories={filterableCategories}
								categoryId={activeCategoryId}
								onCategory={setCategoryId}
								cursor={cursor}
								onCursor={(next) =>
									setCursors((current) => ({
										...current,
										// Normalized here rather than trusted: the period filters
										// fetch on an exact day, or on a week's or month's first
										// instant, so an un-normalized cursor returns an empty
										// screen.
										[cursorUnit]: cursorStart(cursorUnit, next, firstWeekday),
									}))
								}
								income={income}
								onIncome={setIncome}
								firstWeekday={firstWeekday}
								nowMs={nowMs}
								onClear={() => setFilter("all")}
							/>
						)}
						{showUpcomingSection ? (
							<LogUpcoming
								transactions={upcomingRows}
								currency={currency}
								onPress={(id) => router.push(`/transaction/${id}`)}
								onLongPress={(id) => openRowActions(id, true)}
								showCents={showCents}
								showSign={showSign}
								swapTimeLabel={swapTimeLabel}
								nowMs={nowMs}
							/>
						) : null}
						{emptyResult ? <LogNoResults /> : null}
					</>
				}
				renderSectionHeader={({ section }) => (
					<DaySectionHeader
						section={section}
						showCents={showCents}
						first={sections[0] === section && upcomingRows.length === 0}
					/>
				)}
				renderItem={({ item }) => (
					<SwipeableTransactionRow
						transaction={item}
						currency={currency}
						onPress={(id) => router.push(`/transaction/${id}`)}
						onLongPress={(id) => openRowActions(id, false)}
						onDelete={requestDelete}
						showCents={showCents}
						showSign={showSign}
						swapTimeLabel={swapTimeLabel}
					/>
				)}
			/>

			<UndoToast visible={pendingId != null} onUndo={undo} />
			<FloatingAddButton />
		</>
	);
}
