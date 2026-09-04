import { SectionList } from "@legendapp/list/section-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";

import { DaySectionHeader } from "@/components/day-section-header";
import { FloatingAddButton } from "@/components/floating-add-button";
import { useDisplaySettings, useSettingBool, useSettingNumber } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts, useAccountsOverviewIn } from "@/data/accounts";
import { useGlobalCurrency } from "@/data/app-meta";
import { useCategoryMeta } from "@/data/categories";
import { useFavouriteCurrencies } from "@/data/favourite-currencies";
import { useFilteredTransactions, useUpcomingTransactions } from "@/data/log-filtered";
import { logPeriodFromStored, storedLogPeriod, useLogInsights, useSparklineRows } from "@/data/log-totals";
import type { LogPeriod } from "@/data/log-totals";
import { setNumberSetting } from "@/data/settings-core";
import { useLoggedTransactions } from "@/data/transactions";
import type { TransactionWithCategory } from "@/data/transactions";
import { LOG_PAGE_DAYS } from "@/data/transactions-core";
import { logTransferBounds, useLogTransfers } from "@/data/transfer-log";
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
import { logMeasureFromStored, storedLogMeasure } from "@/domain/log-measure";
import type { LogMeasure } from "@/domain/log-measure";
import { cursorStart } from "@/domain/log-period-cursor";
import type { CursorUnit } from "@/domain/log-period-cursor";
import { scopeHasFigures, scopeTotals } from "@/domain/log-scope-figures";
import { sparklineIsPositive, sparklineRange, sparklineSeries } from "@/domain/log-sparkline";
import { mergeByRecency } from "@/domain/transfer-log-rows";
import type { RateTable } from "@/domain/valuation";
import { useTranslation } from "@/i18n/context";
import { useDayCardShare } from "@/lib/use-day-card-share";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";

import { AccountsBlock } from "./components/accounts-block";
import { LogEmptyState } from "./components/log-empty-state";
import { LogFilterChip } from "./components/log-filter-chip";
import type { SparklineData } from "./components/log-insights";
import { LogInsights } from "./components/log-insights";
import { LogNoResults } from "./components/log-no-results";
import { LogToolbar } from "./components/log-toolbar";
import { LogUpcoming } from "./components/log-upcoming";
import { SwipeableTransactionRow } from "./components/swipeable-transaction-row";
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
    rates: RateTable
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
        rates
    );

    return useMemo(() => {
        if (!enabled || period === "all") {
            return null;
        }
        const now = new Date(nowMs);
        const points = sparklineSeries(rows, measure, period, now);
        return {
            byMonth: period === "year",
            points,
            positive: sparklineIsPositive(measure, points),
            range: sparklineRange(period, now, firstWeekday),
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
    // An account inside its undo window is already gone from the accounts screen;
    // it must not linger here as a row that can still be opened.
    const { pendingId: pendingAccountId } = useDeferredDelete("account");
    const accountsOverview = useAccountsOverviewIn(db, valuation, pendingAccountId);
    const accountRows = useAccounts(db);
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
    const [cursors, setCursors] = useState<Record<CursorUnit, Date>>(() => ({
        day: new Date(nowMs),
        month: new Date(nowMs),
        week: new Date(nowMs),
    }));

    const [days, setDays] = useState(LOG_PAGE_DAYS);

    const categoryMeta = useCategoryMeta(db);
    const filterableCategories = useMemo(
        () => [...categoryMeta].filter(([, meta]) => meta.parentId == null).map(([id, meta]) => ({ id, meta })),
        [categoryMeta]
    );
    const activeCategoryId = categoryId ?? filterableCategories[0]?.id ?? null;

    const cursorUnit: CursorUnit = filter === "week" || filter === "month" ? filter : "day";
    // Every unit is seeded above, so this is a stable reference out of state
    // rather than a fresh Date each render.
    const cursor = cursors[cursorUnit];

    const { rows: windowRows, reachedEnd } = useLoggedTransactions(db, nowMs, days);
    const transferBounds = useMemo(
        () =>
            logTransferBounds({
                cursor,
                filter,
                firstWeekday,
                page: { floor: windowRows.at(-1)?.day ?? null, reachedEnd },
            }),
        [cursor, filter, firstWeekday, windowRows, reachedEnd]
    );
    const transferRows = useLogTransfers(db, nowMs, transferBounds);
    const filteredRows = useFilteredTransactions(db, nowMs, {
        categoryId: activeCategoryId,
        cursor,
        filter,
        firstWeekday,
        income,
    });
    const upcoming = useUpcomingTransactions(db, nowMs, showUpcomingSoon);
    const insights = useLogInsights(db, nowMs, period, currency, rates);
    const currencyOptions = useMemo(
        () =>
            logCurrencyOptions({
                // Asked of `valued`, not of `rates`: `rates` holds one currency — the
                // one on screen — so it answers no for every other code, and the chip
                // offered no favourite at all (#237).
                //
                // USD is admitted unconditionally, including on a ledger that has never
                // pulled a rate: `valueExactIn` returns the row's frozen `amountUsd` for
                // a USD display and never reaches the rate table.
                convertible: (code) => code === "USD" || valued.has(code),
                favourites: favouriteCurrencies,
                global: globalCurrency,
                produced: insights.perCurrency.map((figures) => figures.currencyCode),
            }),
        [globalCurrency, favouriteCurrencies, insights, valued]
    );
    const sparkline = useSparkline(db, nowMs, logViewLineGraph, measure, period, firstWeekday, currency, rates);
    const transferIds = useMemo(() => new Set(transferRows.map((transfer) => transfer.id)), [transferRows]);
    const { pendingId, requestDelete } = useDeferredDelete("row");

    const listRows = useMemo(() => {
        if (filter === "transfers") {
            return transferRows;
        }
        return mergeByRecency(filter === "all" ? windowRows : filteredRows, transferRows);
    }, [filter, windowRows, filteredRows, transferRows]);
    const visibleRows = useMemo(() => listRows.filter((row) => row.id !== pendingId), [listRows, pendingId]);
    const sections = useMemo(() => groupByDay(visibleRows, currency, rates), [visibleRows, currency, rates]);
    // Totalled over the filtered read, which `useFilteredTransactions` leaves
    // unwindowed: `windowRows` is a page, so `all` gets the period header instead.
    // The same rows the sections are built from, so the figure and the day
    // subtotals under it agree to the cent.
    const scopeFigures = useMemo(
        () => (filter === "all" || !scopeHasFigures(visibleRows) ? null : scopeTotals(visibleRows, currency, rates)),
        [filter, visibleRows, currency, rates]
    );

    const openRowActions = useTransactionRowActions(nowMs, requestDelete);
    const openAccount = (accountId: string) =>
        router.push({ params: { accountId }, pathname: "/accounts/[accountId]" });
    // A transfer id is not a transaction id: routing it to `transactions/[id]`
    // opens a screen with nothing behind it.
    const openRow = (rowId: string) =>
        router.push(transferIds.has(rowId) ? `/transactions/transfers/${rowId}` : `/transactions/${rowId}`);
    // A transfer has no row menu: its actions live on its own screen, and the
    // hold falls through to opening it.
    const rowMenu = (transaction: TransactionWithCategory, scheduled: boolean) =>
        transferIds.has(transaction.id) ? [] : openRowActions(transaction, scheduled);
    const cardOptions = useMemo(
        () => ({ currency, showCents, swapTimeLabel, use24Hour }),
        [currency, showCents, swapTimeLabel, use24Hour]
    );
    const shareDay = useDayCardShare(cardOptions);

    // Only the period filters name a stretch of time, which the calendar
    // composes; every other scope is a word, and words come from the catalog.
    const detail = filterPeriodUnit(filter)
        ? filterDetail(filter, { cursor, firstWeekday, income })
        : filterScopeLabel(t, filter, activeCategoryId ? categoryMeta.get(activeCategoryId)?.name : null, income);

    const showUpcomingSection = filter === "upcoming" || (filter === "all" && showUpcoming);
    // Filtered on `pendingId` like the day sections are: a future-dated row is
    // drawn here rather than below, so without this a delete of one leaves it on
    // screen for the whole undo window, under a toast saying it is gone.
    const upcomingRows = useMemo(
        () => (showUpcomingSection ? upcoming.rows.filter((row) => row.id !== pendingId) : []),
        [showUpcomingSection, upcoming.rows, pendingId]
    );
    const emptyResult = sections.length === 0 && (filter !== "upcoming" || upcomingRows.length === 0);

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

    if (listRows.length === 0 && filter === "all") {
        return (
            <>
                {accountsOverview ? (
                    // The block rides a scroll view for its automatic inset: the header
                    // is transparent, so anything laid out flat here starts under the
                    // large title. It scrolls, because four account rows plus the empty
                    // state outgrow a landscape or large-type viewport.
                    <ScrollView
                        className="bg-background"
                        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}
                        contentInsetAdjustmentBehavior="automatic"
                    >
                        <AccountsBlock
                            accounts={accountRows}
                            currency={currency}
                            onOpen={openAccount}
                            onOpenAll={() => router.push("/accounts")}
                            overview={accountsOverview}
                            showCents={showCents}
                        />
                        <LogEmptyState />
                    </ScrollView>
                ) : (
                    <LogEmptyState />
                )}
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
                    flexGrow: 1,
                    // `NativeTabs` supplies the bar + safe-area inset; this only clears
                    // the floating add button.
                    paddingBottom: 100,
                    paddingHorizontal: 20,
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
                            <AccountsBlock
                                accounts={accountRows}
                                currency={currency}
                                onOpen={openAccount}
                                onOpenAll={() => router.push("/accounts")}
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
                                onPress={openRow}
                                menuItems={(transaction) => rowMenu(transaction, true)}
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
                        onShare={() => shareDay(section)}
                    />
                )}
                renderItem={({ item }) => (
                    <SwipeableTransactionRow
                        transaction={item}
                        currency={currency}
                        rates={rates}
                        onPress={openRow}
                        menuItems={rowMenu(item, false)}
                        onDelete={requestDelete}
                    />
                )}
            />

            <FloatingAddButton />
        </>
    );
}
