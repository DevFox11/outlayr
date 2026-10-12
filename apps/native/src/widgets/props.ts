import { advanceBudgetWindow } from "@outlayr/money/budget-window";
import { startOfDay } from "@outlayr/money/calendar";
import { limitIn } from "@outlayr/money/valuation";
import { and, asc, desc, isNull, lte } from "drizzle-orm";

import { getMeta, META_KEYS } from "@/data/app-meta-core";
import type { SpendDb } from "@/data/budget-spent";
import { OVERALL_BUDGET_ID } from "@/data/budgets-core";
import { bucketSeries, categoryBreakdown, loadContributions, windowLabel, windowTotals } from "@/data/insights";
import type { InsightsCalendar, InsightsPeriod, WindowTotals } from "@/data/insights";
import { writeIdsByTransaction } from "@/data/pending-writes-core";
import { parseBoolSetting, parseIntSetting } from "@/data/settings-core";
import { loadValuation } from "@/data/valuation-source";
import type { Valuation } from "@/data/valuation-source";
import {
    budgets as budgetsTable,
    categories as categoriesTable,
    mainBudget as mainBudgetTable,
    transactions as transactionsTable,
} from "@/db/schema";
import { budgetPeriodPhrase } from "@/domain/budget-math";
import { compareBudgetSeverity } from "@/domain/budget-severity";
import { formatDateHeader, formatDayHeader, formatUpcomingDate, weekdayInitial } from "@/domain/dates";
import { DEFAULT_CURRENCY, formatAmount } from "@/domain/money";
import type { TranslationKey } from "@/i18n/catalog";
import { translateNow } from "@/i18n/runtime";
import { DEEP_LINKS } from "@/lib/deep-links";

import { WIDGET_PALETTE } from "./palette";
import { NO_BUDGET } from "./placeholders";

/**
 * A widget renders in whatever appearance the home screen is in, which is not
 * necessarily the app's, and `environment.colorScheme` is only known inside the
 * layout — so the layout is handed both sides and picks. See `palette.ts` for
 * why the colours travel as data at all.
 */
type WidgetChrome = typeof WIDGET_PALETTE;

/** What a large widget holds at the Log's row rhythm; medium takes the first 3. */
const LEDGER_LIMIT = 8;
/** Past five, the slices are thinner than the hairline between them. */
const SLICE_LIMIT = 4;
const WEEK_DAYS = 7;

/** Which budget a configured tile is pinned to. */
type BudgetSelection = "auto" | "overall" | "worst";

export interface BudgetConfiguration {
    budget: BudgetSelection;
}

export interface BudgetViewProps {
    /** How far through the period we are, in [0, 1] — the pace marker. */
    elapsedFraction: number;
    /**
     * Window end in epoch ms — the one instant at which every figure above
     * becomes wrong. The publisher schedules the next timeline entry here instead
     * of polling, and the watch hides the budget past it and extrapolates the
     * pace marker from it.
     */
    endsAt: number;
    /**
     * Whether `name` is the overall budget or the per-category one this fell back
     * to. The layout must say which: "$189 LEFT · THIS MONTH" without the name
     * reads as the whole month when it is only Groceries.
     */
    isOverall: boolean;
    limit: string;
    name: string;
    over: boolean;
    percent: string;
    /** Eyebrow copy, e.g. "THIS MONTH". */
    periodLabel: string;
    /** False when no budget of any kind exists — the layout pitches one instead. */
    present: boolean;
    /** Compact window, e.g. "1 – 31 JUL". */
    rangeLabel: string;
    /** The hero figure, already in the user's currency and cents preference. */
    remaining: string;
    /** The localized "LEFT"/"OVER" — the sign is in the word, never in a minus. */
    remainingCaption: string;
    /**
     * Cents off regardless of the "Display Cents" setting, matching `BudgetRow`'s
     * meta line — on a small widget "$1,873.59" is four glyphs past what the
     * column can hold.
     */
    spent: string;
    /** Spend as a fraction of the limit, clamped to [0, 1] for the gauge. */
    spentFraction: number;
    url: string;
}

/**
 * Every budget the tile can be pinned to, derived on every publish. A widget
 * body cannot query, so a configuration can only ever choose between views that
 * are already in the payload — which is also why `auto` is materialised rather
 * than resolved in the layout: it is the one the tile shows unconfigured, and it
 * has to stay byte-identical to what shipped before configuration existed.
 */
export interface BudgetWidgetProps {
    chrome: WidgetChrome;
    views: Record<BudgetSelection, BudgetViewProps>;
}

export interface LedgerEntryProps {
    /** Unsigned; `income` decides the colour and the sign glyph. */
    amount: string;
    color: string;
    day: string;
    /** Empty string rather than null — the layout branches on truthiness. */
    emoji: string;
    id: string;
    income: boolean;
    note: string;
}

export interface WatchEntryProps extends LedgerEntryProps {
    at: number;
    category: string;
    date: string;
    rootCategoryId: string | null;
    writeId: string | null;
}

/** What the Ledger's header figure can be pinned to. `"today"` is its default. */
type LedgerHeaderPeriod = "today" | InsightsPeriod;
type LedgerHeaderMeasure = "spent" | "income" | "net";

interface LedgerHeaderProps {
    amount: string;
    label: string;
    /** Net can be either way round; the sign is the figure's, not a glyph's. */
    positive: boolean;
}

export interface LedgerConfiguration {
    measure: LedgerHeaderMeasure;
    period: LedgerHeaderPeriod;
}

export interface LedgerWidgetProps {
    chrome: WidgetChrome;
    entries: LedgerEntryProps[];
    /**
     * Every combination the configuration can name, precomputed.
     *
     * The widget runs in a separate process with no database, so it cannot answer
     * a choice it was not handed — the same reason `Insights` ships every window
     * rather than the one currently selected.
     */
    headers: Record<LedgerHeaderPeriod, Record<LedgerHeaderMeasure, LedgerHeaderProps>>;
    url: string;
}

/** `"app"` follows the app's own `insightsTimeFrame`; the rest pin the tile. */
type InsightsSelection = "app" | InsightsPeriod;

export interface InsightsConfiguration {
    period: InsightsSelection;
}

export interface InsightsViewProps {
    /** `ChartDataPoint` shape, oldest first — spend per bucket. */
    bars: { x: string; y: number }[];
    income: string;
    /** Net for the window, signed by `netPositive` rather than by a glyph. */
    net: string;
    netPositive: boolean;
    periodLabel: string;
    rangeLabel: string;
    slices: { name: string; color: string; amount: string; fraction: number }[];
    spent: string;
    url: string;
}

export interface InsightsWidgetProps {
    chrome: WidgetChrome;
    /** The app's own `insightsTimeFrame` — what an unconfigured tile shows. */
    defaultPeriod: InsightsPeriod;
    windows: Record<InsightsPeriod, InsightsViewProps>;
}

export interface LogWidgetProps {
    chrome: WidgetChrome;
    todayLabel: string;
    todaySpent: string;
    /** Always the new-expense form — the tile is one target, see `log.tsx`. */
    url: string;
}

/**
 * One budget as Siri can name it. Not a widget's props — `CheckBudgetIntent` has
 * to resolve a spoken name against every budget, so the list is derived in the
 * same pass and published to the App Group.
 */
interface IntentBudgetProps {
    id: string;
    limit: string;
    name: string;
    percent: string;
    periodLabel: string;
    remaining: string;
    remainingCaption: string;
    spent: string;
}

export interface CategoryProps {
    color: string;
    emoji: string;
    id: string;
    income: boolean;
    name: string;
}

export interface WeekProps {
    average: string;
    days: { label: string; value: number }[];
}

export interface WidgetProps {
    Budget: BudgetWidgetProps;
    categories: CategoryProps[];
    currency: string;
    Insights: InsightsWidgetProps;
    /** Every budget, overall first — see {@link IntentBudgetProps}. */
    intentBudgets: IntentBudgetProps[];
    Ledger: LedgerWidgetProps;
    Log: LogWidgetProps;
    showCents: boolean;
    watchEntries: WatchEntryProps[];
    week: WeekProps;
    zeroSpent: string;
}

/** The Insights period codes as stored (`insightsTimeFrame`). */
// Keyed by the stored insights period setting, which is a plain number.
const PERIODS = new Map<number, InsightsPeriod>([
    [1, "week"],
    [2, "month"],
    [3, "year"],
]);

const PERIOD_EYEBROW = {
    month: "insights.quiet.thisMonth",
    week: "insights.quiet.thisWeek",
    year: "insights.quiet.thisYear",
} satisfies Readonly<Record<InsightsPeriod, TranslationKey>>;

/**
 * "1 – 31 JUL", collapsing the month when both ends share one. `end` is the
 * window's exclusive end, so this steps back a millisecond to name the last day
 * actually inside the period rather than the first day of the next.
 */
function rangeLabel(start: Date, end: Date): string {
    const last = new Date(end.getTime() - 1);
    if (start.getMonth() === last.getMonth()) {
        return `${start.getDate()} – ${formatUpcomingDate(last)}`;
    }
    return `${formatUpcomingDate(start)} – ${formatUpcomingDate(last)}`;
}

function clamp01(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return Math.min(1, value);
}

type Contribution = Awaited<ReturnType<typeof loadContributions>>[number];
interface CategoryRow {
    color: string | null;
    emoji: string | null;
    icon: string | null;
    id: string;
    income: boolean;
    name: string | null;
    parentId: string | null;
    sortOrder: number;
}

/**
 * Everything the three widgets render, read out of SQLite in one pass and
 * already formatted.
 *
 * Formatting has to happen here: a widget body runs in the extension's own
 * `JSContext` with none of this bundle in scope, so it could not call
 * `formatAmount` even if asked.
 *
 * Runs outside React (on background, after a queued write lands), so it is a
 * plain async function over `SpendDb` and testable against `better-sqlite3`.
 */
export async function buildWidgetProps(db: SpendDb, now: Date = new Date()): Promise<WidgetProps> {
    const [currencyRaw, showCentsRaw, weekdayRaw, monthDayRaw, periodRaw] = await Promise.all([
        getMeta(db, META_KEYS.currency),
        getMeta(db, "showCents"),
        getMeta(db, "firstWeekday"),
        getMeta(db, "firstDayOfMonth"),
        getMeta(db, "insightsTimeFrame"),
    ]);

    const currency = currencyRaw ?? DEFAULT_CURRENCY;
    const showCents = parseBoolSetting(showCentsRaw, true);
    const calendar: InsightsCalendar = {
        firstDayOfMonth: parseIntSetting(monthDayRaw, 1),
        firstWeekday: parseIntSetting(weekdayRaw, 1),
    };
    const period = PERIODS.get(parseIntSetting(periodRaw, 1)) ?? "week";
    const money = (value: number) => formatAmount(value, currency, showCents);
    /** Supporting figures, cents always off — see `BudgetWidgetProps.spent`. */
    const whole = (value: number) => formatAmount(value, currency, false);
    const entryMoney = (value: number, code: string | null) => formatAmount(value, code ?? currency, showCents);

    const valuation = await loadValuation(db);
    const contributions = await loadContributions(db, now, valuation);
    const categoryRows = await db
        .select({
            color: categoriesTable.color,
            emoji: categoriesTable.emoji,
            icon: categoriesTable.icon,
            id: categoriesTable.id,
            income: categoriesTable.income,
            name: categoriesTable.name,
            parentId: categoriesTable.parentId,
            sortOrder: categoriesTable.sortOrder,
        })
        .from(categoriesTable)
        .where(isNull(categoriesTable.deletedAt))
        .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
    const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
    const budgets = await budgetFigures(db, now, contributions, valuation);
    const watchEntries = await buildWatchEntries(db, now, categoriesById, entryMoney);

    return {
        Budget: buildBudget(budgets, now, categoriesById, money, whole),
        categories: categoryRows
            .filter((row) => row.parentId === null)
            .map((row) => ({
                color: row.color ?? WIDGET_PALETTE.light.ink,
                emoji: row.emoji ?? "",
                id: row.id,
                income: row.income,
                name: row.name ?? "",
            })),
        currency,
        Insights: {
            chrome: WIDGET_PALETTE,
            defaultPeriod: period,
            windows: {
                month: buildInsights(contributions, categoriesById, "month", now, calendar, money),
                week: buildInsights(contributions, categoriesById, "week", now, calendar, money),
                year: buildInsights(contributions, categoriesById, "year", now, calendar, money),
            },
        },
        Ledger: {
            chrome: WIDGET_PALETTE,
            entries: watchEntries.map(({ amount, color, day, emoji, id, income, note }) => ({
                amount,
                color,
                day,
                emoji,
                id,
                income,
                note,
            })),
            headers: buildLedgerHeaders(contributions, now, calendar, money),
            url: DEEP_LINKS.log,
        },
        Log: {
            chrome: WIDGET_PALETTE,
            todayLabel: translateNow("common.today").toUpperCase(),
            todaySpent: money(sumExpenses(contributions, startOfDay(now), now, null)),
            url: DEEP_LINKS.newExpense,
        },
        intentBudgets: buildIntentBudgets(budgets, categoriesById, money, whole),
        showCents,
        watchEntries,
        week: buildWeek(contributions, now, whole),
        zeroSpent: money(0),
    };
}

type Money = (value: number) => string;

type EntryMoney = (value: number, code: string | null) => string;

/**
 * The overall budget and the worst-off per-category one, plus the automatic
 * pick between them — the overall budget when there is one.
 */
/**
 * Every budget with the figures both builders need, read once. `buildBudget` and
 * `buildIntentBudgets` are assembled in the same pass, so without this they each
 * ran the same two selects and re-derived the same window, limit and spend.
 */
async function budgetFigures(db: SpendDb, now: Date, contributions: readonly Contribution[], valuation: Valuation) {
    const measure = (
        row: {
            amount: number;
            amountUsd: number | null;
            currency: string | null;
            startDate: Date | null;
            type: number;
        },
        categoryId: string | null
    ) => {
        const window = advanceBudgetWindow(row.startDate ?? now, row.type, now);
        return {
            limit: limitIn(row, window.start, valuation.displayCurrency, valuation.rates),
            spent: sumExpenses(contributions, window.start, now, categoryId),
            window,
        };
    };

    const [main] = await db.select().from(mainBudgetTable).where(isNull(mainBudgetTable.deletedAt)).limit(1);
    const categoryRows = await db
        .select()
        .from(budgetsTable)
        .where(isNull(budgetsTable.deletedAt))
        .orderBy(asc(budgetsTable.dateCreated));

    return {
        categories: categoryRows.map((row) => ({ row, ...measure(row, row.categoryId) })),
        main: main ? { row: main, ...measure(main, null) } : null,
    };
}

function buildBudget(
    figures: Awaited<ReturnType<typeof budgetFigures>>,
    now: Date,
    categoriesById: ReadonlyMap<string, CategoryRow>,
    money: Money,
    whole: Money
): BudgetWidgetProps {
    const empty: BudgetViewProps = {
        ...NO_BUDGET,
        name: translateNow("budgets.widget.none"),
        periodLabel: translateNow("budgets.name.default").toUpperCase(),
    };

    let overall = empty;
    if (figures.main) {
        const { row, limit, spent, window } = figures.main;
        overall = present(
            row.name?.trim() ? row.name.trim() : translateNow("budgets.scope.everything"),
            true,
            limit,
            spent,
            row.type,
            window,
            DEEP_LINKS.overallBudget
        );
    }

    let worst = empty;
    // The same order the Budgets screen ranks by. Its own comparator puts an
    // over-budget one first and guards the zero limit — `spent / 0` is `Infinity`
    // for anything spent and `NaN` for nothing, and a comparator returning either
    // hands "worst" to a budget with no limit at all while the one genuinely over
    // is not shown.
    const [ranked] = [...figures.categories].sort((a, b) =>
        compareBudgetSeverity(
            { amount: a.limit, overBudget: a.spent > a.limit, spent: a.spent },
            { amount: b.limit, overBudget: b.spent > b.limit, spent: b.spent }
        )
    );
    if (ranked) {
        // Name precedence mirrors `usePerCategoryBudgets`.
        const rankedCategory = ranked.row.categoryId ? categoriesById.get(ranked.row.categoryId) : undefined;
        worst = present(
            ranked.row.name?.trim()
                ? ranked.row.name.trim()
                : (rankedCategory?.name ?? translateNow("budgets.name.default")),
            false,
            ranked.limit,
            ranked.spent,
            ranked.row.type,
            ranked.window,
            `${DEEP_LINKS.budgets}/${ranked.row.id}`
        );
    }

    return {
        chrome: WIDGET_PALETTE,
        views: { auto: overall.present ? overall : worst, overall, worst },
    };

    function present(
        name: string,
        isOverall: boolean,
        amount: number,
        spent: number,
        type: number,
        window: { start: Date; end: Date },
        url: string
    ): BudgetViewProps {
        const over = spent > amount;
        const span = window.end.getTime() - window.start.getTime();
        const fraction = amount > 0 ? spent / amount : 0;
        return {
            elapsedFraction: clamp01(span > 0 ? (now.getTime() - window.start.getTime()) / span : 0),
            endsAt: window.end.getTime(),
            isOverall,
            limit: whole(amount),
            name,
            over,
            percent: `${Math.round(fraction * 100)}%`,
            periodLabel: translateNow(budgetPeriodPhrase(type)).toUpperCase(),
            present: true,
            rangeLabel: rangeLabel(window.start, window.end),
            remaining: money(Math.abs(amount - spent)),
            remainingCaption: translateNow(over ? "budgets.suffix.over" : "budgets.suffix.left").toUpperCase(),
            spent: whole(spent),
            spentFraction: clamp01(fraction),
            url,
        };
    }
}

/** Every budget the user has, overall first, each with its current figures. */
function buildIntentBudgets(
    figures: Awaited<ReturnType<typeof budgetFigures>>,
    categoriesById: ReadonlyMap<string, CategoryRow>,
    money: Money,
    whole: Money
): IntentBudgetProps[] {
    const view = (id: string, name: string, amount: number, spent: number, type: number): IntentBudgetProps => ({
        id,
        limit: whole(amount),
        name,
        percent: `${Math.round((amount > 0 ? spent / amount : 0) * 100)}%`,
        periodLabel: translateNow(budgetPeriodPhrase(type)),
        remaining: money(Math.abs(amount - spent)),
        remainingCaption: translateNow(spent > amount ? "budgets.suffix.over" : "budgets.suffix.left"),
        spent: whole(spent),
    });

    const out: IntentBudgetProps[] = [];

    if (figures.main) {
        const { row, limit, spent } = figures.main;
        out.push(
            view(
                OVERALL_BUDGET_ID,
                row.name?.trim() ? row.name.trim() : translateNow("budgets.scope.everything"),
                limit,
                spent,
                row.type
            )
        );
    }

    for (const { row, limit, spent } of figures.categories) {
        const meta = row.categoryId ? categoriesById.get(row.categoryId) : undefined;
        out.push(
            view(
                row.id,
                row.name?.trim() ? row.name.trim() : (meta?.name ?? translateNow("budgets.name.default")),
                limit,
                spent,
                row.type
            )
        );
    }

    return out;
}

/** The income counterpart of {@link sumExpenses}, unscoped by category. */
function sumIncome(rows: readonly Contribution[], start: Date, now: Date): number {
    const startMs = start.getTime();
    const nowMs = now.getTime();
    let total = 0;
    for (const row of rows) {
        const t = row.date.getTime();
        if (row.income && t >= startMs && t <= nowMs) {
            total += row.amount;
        }
    }
    return total;
}

function sumExpenses(rows: readonly Contribution[], start: Date, now: Date, categoryId: string | null): number {
    const startMs = start.getTime();
    const nowMs = now.getTime();
    let total = 0;
    for (const row of rows) {
        if (row.income) {
            continue;
        }
        const t = row.date.getTime();
        if (t < startMs || t > nowMs) {
            continue;
        }
        if (categoryId == null || row.categoryId === categoryId || row.parentId === categoryId) {
            total += row.amount;
        }
    }
    return total;
}

function buildWeek(contributions: readonly Contribution[], now: Date, whole: Money): WeekProps {
    const today = startOfDay(now);
    const starts = Array.from(
        { length: WEEK_DAYS },
        (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (WEEK_DAYS - 1 - index))
    );
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
    const values = starts.map(() => 0);
    for (const row of contributions) {
        const t = row.date.getTime();
        if (row.income || t < starts[0].getTime() || t >= end) {
            continue;
        }
        const index = starts.findLastIndex((start) => start.getTime() <= t);
        values[index] += row.amount;
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        average: whole(total / WEEK_DAYS),
        days: starts.map((start, index) => ({ label: weekdayInitial(start), value: values[index] })),
    };
}

async function buildWatchEntries(
    db: SpendDb,
    now: Date,
    categoriesById: ReadonlyMap<string, CategoryRow>,
    entryMoney: EntryMoney
): Promise<WatchEntryProps[]> {
    const rows = await db
        .select({
            amount: transactionsTable.amount,
            categoryId: transactionsTable.categoryId,
            currency: transactionsTable.currency,
            customColor: transactionsTable.customColor,
            date: transactionsTable.date,
            emoji: transactionsTable.emoji,
            id: transactionsTable.id,
            imageColor: transactionsTable.imageColor,
            income: transactionsTable.income,
            note: transactionsTable.note,
        })
        .from(transactionsTable)
        .where(and(isNull(transactionsTable.deletedAt), lte(transactionsTable.date, now)))
        .orderBy(desc(transactionsTable.date))
        .limit(LEDGER_LIMIT);
    const writeIds = await writeIdsByTransaction(db);

    return rows.map((row) => {
        const category = row.categoryId ? categoriesById.get(row.categoryId) : undefined;
        return {
            amount: entryMoney(row.amount, row.currency),
            at: row.date.getTime(),
            category: category?.name ?? "",
            // Identity precedence, matching the form.
            color: row.customColor ?? row.imageColor ?? category?.color ?? "#767676",
            date: formatDateHeader(row.date, now),
            day: formatDayHeader(row.date, now),
            // Hugeicons glyphs are a React Native font the widget runtime does not
            // link, so an icon identity degrades to its colour dot. An emoji is
            // just text and crosses the process boundary intact.
            emoji: row.emoji ?? category?.emoji ?? "",
            id: row.id,
            income: row.income,
            note: row.note,
            rootCategoryId: category?.parentId ?? row.categoryId,
            writeId: writeIds.get(row.id) ?? null,
        };
    });
}

/**
 * Every period/measure pairing the Ledger's header can be set to.
 *
 * `today` is computed from the raw contributions rather than through
 * `windowTotals`, which has no day window — the tile has always led with today
 * and that stays its default, so an installed widget does not silently change
 * what it reports.
 */
function buildLedgerHeaders(
    contributions: readonly Contribution[],
    now: Date,
    calendar: InsightsCalendar,
    money: Money
) {
    const measures = (label: string, totals: WindowTotals) => {
        const net = totals.income - totals.spent;
        return {
            income: { amount: money(totals.income), label, positive: true },
            net: { amount: money(Math.abs(net)), label, positive: net >= 0 },
            spent: { amount: money(totals.spent), label, positive: false },
        } satisfies Record<LedgerHeaderMeasure, LedgerHeaderProps>;
    };

    const startToday = startOfDay(now);
    return {
        month: measures(
            translateNow("insights.period.month").toUpperCase(),
            windowTotals(contributions, "month", now, 0, calendar)
        ),
        today: measures(translateNow("common.today").toUpperCase(), {
            income: sumIncome(contributions, startToday, now),
            spent: sumExpenses(contributions, startToday, now, null),
        }),
        week: measures(
            translateNow("insights.period.week").toUpperCase(),
            windowTotals(contributions, "week", now, 0, calendar)
        ),
        year: measures(
            translateNow("insights.period.year").toUpperCase(),
            windowTotals(contributions, "year", now, 0, calendar)
        ),
    } satisfies Record<LedgerHeaderPeriod, Record<LedgerHeaderMeasure, LedgerHeaderProps>>;
}

function buildInsights(
    contributions: readonly Contribution[],
    categoriesById: ReadonlyMap<string, CategoryRow>,
    period: InsightsPeriod,
    now: Date,
    calendar: InsightsCalendar,
    money: Money
): InsightsViewProps {
    const totals = windowTotals(contributions, period, now, 0, calendar);
    const net = totals.income - totals.spent;
    const slices = categoryBreakdown(contributions, categoriesById, period, "spent", now, 0, calendar).slice(
        0,
        SLICE_LIMIT
    );

    return {
        bars: bucketSeries(contributions, period, "spent", now, 0, calendar).map((bucket) => ({
            x: bucket.label,
            y: bucket.value,
        })),
        income: money(totals.income),
        net: money(Math.abs(net)),
        netPositive: net >= 0,
        periodLabel: translateNow(PERIOD_EYEBROW[period]).toUpperCase(),
        rangeLabel: windowLabel(period, 0, now, calendar),
        slices: slices.map((slice) => ({
            amount: money(slice.amount),
            color: slice.color,
            fraction: slice.fraction,
            name: slice.name,
        })),
        spent: money(totals.spent),
        url: DEEP_LINKS.insights,
    };
}
