import { SectionList } from "@legendapp/list/section-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { DaySectionHeader } from "@/components/day-section-header";
import { FloatingAddButton } from "@/components/floating-add-button";
import {
	useDisplaySettings,
	useSettingBool,
	useSettingNumber,
} from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountsOverviewIn } from "@/data/accounts";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoryMeta } from "@/data/categories";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
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
import { setNumberSetting } from "@/data/settings";
import { LOG_PAGE_DAYS, useLoggedTransactions } from "@/data/transactions";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import { useValuationIn } from "@/data/use-valuation";
import { useValuedCurrencies } from "@/data/valued-currencies";
import type { Database } from "@/db/client";
import { addDays, addMonths, startOfDay } from "@/domain/dates";
import { groupByDay } from "@/domain/day-sections";
import { logCurrencyOptions } from "@/domain/log-currency-options";
import type { LogFilter } from "@/domain/log-filter";
import { filterDetail, filterPeriodUnit } from "@/domain/log-filter";
import {
	type LogMeasure,
	logMeasureFromStored,
	storedLogMeasure,
} from "@/domain/log-measure";
import { cursorStart } from "@/domain/log-period-cursor";
import { scopeTotals } from "@/domain/log-scope-figures";
import {
	sparklineIsPositive,
	sparklineRange,
	sparklineSeries,
} from "@/domain/log-sparkline";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n";
import { useDayCardShare } from "@/lib/use-day-card-share";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { AccountsOverviewCard } from "./components/accounts-overview-card";
import { LogEmptyState } from "./components/log-empty-state";
import { LogFilterChip } from "./components/log-filter-chip";
import type { SparklineData } from "./components/log-insights";
import { LogInsights } from "./components/log-insights";
import { LogNoResults } from "./components/log-no-results";
import { LogToolbar } from "./components/log-toolbar";
import { LogUpcoming } from "./components/log-upcoming";
import { SwipeableTransactionRow } from "./components/swipeable-transaction-row";
import { UndoToast } from "./components/undo-toast";
import { filterScopeLabel } from "./labels";

export function Log() {
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
	displayCurrency: string,
	rates: RateTable,
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
		displayCurrency,
		rates,
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
	const t = useTranslation();
	// Screen state, never a setting: writing the choice to `appMeta` would also
	// restate what the ledger is kept in, which is what the next transaction gets
	// recorded in. Null means the screen follows the ledger's currency.
	const [displayOverride, setDisplayOverride] = useState<string | null>(null);
	const globalCurrency = useGlobalCurrency(db);
	const favouriteCurrencies = useFavouriteCurrencies(db);
	const valuation = useValuationIn(db, displayOverride ?? globalCurrency);
	const { displayCurrency: currency, rates } = valuation;
	const accountsOverview = useAccountsOverviewIn(db, valuation);
	const valued = useValuedCurrencies(db);
	const { showCents, swapTimeLabel, use24Hour } = useDisplaySettings().state;
	const showUpcoming = useSettingBool("showUpcoming");
	const showUpcomingSoon = useSettingBool("showUpcomingSoon");
	const logViewLineGraph = useSettingBool("logViewLineGraph");
	const firstWeekday = useSettingNumber("firstWeekday");
	const period = logPeriodFromStored(useSettingNumber("logInsightsTimeFrame"));
	const measure = logMeasureFromStored(useSettingNumber("logInsightsType"));
	const nowMs = useNow();

	const [filter, setFilter] = useState<LogFilter>("all");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [income, setIncome] = useState(false);
	// One cursor per period unit, so switching between them leaves each where it
	// was. Seeded once: re-seeding as the clock ticks would step the calendar
	// filters out from under the user.
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
	const upcoming = useUpcomingTransactions(db, nowMs, showUpcomingSoon);
	const insights = useLogInsights(db, nowMs, period, currency, rates);
	const currencyOptions = useMemo(
		() =>
			logCurrencyOptions({
				global: globalCurrency,
				favourites: favouriteCurrencies,
				produced: insights.perCurrency.map((figures) => figures.currencyCode),
				// Asked of `valued`, not of `rates`: `rates` holds one currency — the
				// one on screen — so it answers no for every other code, and the chip
				// offered no favourite at all (#237).
				//
				// USD is admitted unconditionally, including on a ledger that has never
				// pulled a rate: `valueExactIn` returns the row's frozen `amountUsd` for
				// a USD display and never reaches the rate table.
				convertible: (code) => code === "USD" || valued.has(code),
			}),
		[globalCurrency, favouriteCurrencies, insights, valued],
	);
	const sparkline = useSparkline(
		db,
		nowMs,
		logViewLineGraph,
		measure,
		period,
		firstWeekday,
		currency,
		rates,
	);
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);

	const listRows = filter === "all" ? windowRows : filteredRows;
	const visibleRows = useMemo(
		() => listRows.filter((row) => row.id !== pendingId),
		[listRows, pendingId],
	);
	const sections = useMemo(
		() => groupByDay(visibleRows, currency, rates),
		[visibleRows, currency, rates],
	);
	// Totalled over the filtered read, which `useFilteredTransactions` leaves
	// unwindowed: `windowRows` is a page, so `all` gets the period header instead.
	// The same rows the sections are built from, so the figure and the day
	// subtotals under it agree to the cent.
	const scopeFigures = useMemo(
		() =>
			filter === "all" || visibleRows.length === 0
				? null
				: scopeTotals(visibleRows, currency, rates),
		[filter, visibleRows, currency, rates],
	);

	const openRowActions = useTransactionRowActions(db, nowMs, requestDelete);
	const cardOptions = useMemo(
		() => ({ currency, showCents, swapTimeLabel, use24Hour }),
		[currency, showCents, swapTimeLabel, use24Hour],
	);
	const shareDay = useDayCardShare(cardOptions);

	// Only the period filters name a stretch of time, which the calendar
	// composes; every other scope is a word, and words come from the catalog.
	const detail = filterPeriodUnit(filter)
		? filterDetail(filter, { cursor, income, firstWeekday })
		: filterScopeLabel(
				t,
				filter,
				activeCategoryId ? categoryMeta.get(activeCategoryId)?.name : null,
				income,
			);

	const showUpcomingSection =
		filter === "upcoming" || (filter === "all" && showUpcoming);
	const upcomingRows = showUpcomingSection ? upcoming.rows : [];
	const emptyResult =
		sections.length === 0 &&
		(filter !== "upcoming" || upcomingRows.length === 0);

	// One setting behind both headers: the promoted figure must not depend on
	// whether a filter happens to be on.
	const onMeasure = (next: LogMeasure) => {
		setNumberSetting(db, "logInsightsType", storedLogMeasure(next));
	};

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
				// `ReanimatedSwipeable` keeps its open/closed offset inside the row
				// instance, so a recycled row would inherit the previous row's swipe.
				recycleItems={false}
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
								onMeasure={onMeasure}
								period={period}
								displayCurrency={currency}
								currencyOptions={currencyOptions}
								onDisplayCurrency={setDisplayOverride}
								onManageCurrencies={() => router.push("/settings/currency")}
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
								totals={scopeFigures}
								measure={measure}
								onMeasure={onMeasure}
								displayCurrency={currency}
							/>
						)}
						{filter === "all" ? (
							<AccountsOverviewCard
								currency={currency}
								onPress={() => router.push("/settings/accounts")}
								overview={accountsOverview}
								showCents={showCents}
							/>
						) : null}
						{showUpcomingSection ? (
							<LogUpcoming
								transactions={upcomingRows}
								schedules={upcoming.schedules}
								currency={currency}
								rates={rates}
								onPress={(id) => router.push(`/transactions/${id}`)}
								onLongPress={(id) => openRowActions(id, true)}
								nowMs={nowMs}
							/>
						) : null}
						{emptyResult ? <LogNoResults /> : null}
					</>
				}
				renderSectionHeader={({ section }) => (
					<DaySectionHeader
						section={section}
						first={sections[0] === section && upcomingRows.length === 0}
						onLongPress={() => shareDay(section)}
					/>
				)}
				renderItem={({ item }) => (
					<SwipeableTransactionRow
						transaction={item}
						currency={currency}
						rates={rates}
						onPress={(id) => router.push(`/transactions/${id}`)}
						onLongPress={(id) => openRowActions(id, false)}
						onDelete={requestDelete}
					/>
				)}
			/>

			<UndoToast visible={pendingId != null} onUndo={undo} />
			<FloatingAddButton />
		</>
	);
}
