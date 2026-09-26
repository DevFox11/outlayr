import type { LedgerCell } from "@/components/ledger-head";
import type { LogPeriod } from "@/data/log-totals";
import type { LogFilter } from "@/domain/log-filter";
import { measureAlternatives, measureIsIncome, measureIsPositive, measureMagnitude } from "@/domain/log-measure";
import type { LogFigures, LogMeasure } from "@/domain/log-measure";
import type { TranslationKey } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";

/**
 * The domain modules keep their labels as module-level constants, which resolve
 * once at import and so cannot follow a language change. Screens name the copy
 * through these keys instead and leave the constants to non-visual callers.
 */
export const FILTER_LABEL_KEY = {
    all: "log.filter.all",
    category: "log.filter.category",
    day: "log.filter.day",
    month: "log.filter.month",
    recurring: "log.filter.recurring",
    transfers: "log.filter.transfers",
    type: "log.filter.type",
    upcoming: "log.filter.upcoming",
    week: "log.filter.week",
} satisfies Record<LogFilter, TranslationKey>;

export const PERIOD_PHRASE_KEY = {
    all: "log.period.all",
    day: "log.period.day",
    month: "log.period.month",
    week: "log.period.week",
    year: "log.period.year",
} satisfies Record<LogPeriod, TranslationKey>;

export const MEASURE_WORD_KEY = {
    in: "log.measure.in",
    net: "log.measure.net",
    out: "log.measure.out",
} satisfies Record<LogMeasure, TranslationKey>;

/**
 * The other two measures, as cells the ledger head can draw and press.
 *
 * The head is the same on the Log and behind the filter chip, and the two must
 * offer the same alternatives on the same figures or the screen contradicts
 * itself when a filter goes on.
 */
export function measureCells(
    measure: LogMeasure,
    figures: LogFigures,
    t: TranslateFn,
    onMeasure: (next: LogMeasure) => void
): LedgerCell[] {
    return measureAlternatives(measure).map((alternative) => ({
        income: measureIsIncome(alternative),
        label: t(MEASURE_WORD_KEY[alternative]),
        magnitude: measureMagnitude(alternative, figures),
        onPress: () => onMeasure(alternative),
        positive: measureIsPositive(alternative, figures),
    }));
}

/**
 * The eyebrow over the filtered scope's figure. `shownCurrency` is what that
 * figure is actually denominated in, which is not always what was asked for:
 * `scopeTotals` falls back to the scope's dominant bucket when the scope holds
 * nothing that can be placed in the display currency. Since a symbol is shared
 * by several currencies — COP, MXN and USD all print "$" — an unnamed fallback
 * figure reads as an amount of the wrong money, so it names itself here.
 */
export function scopeMeasureLabel(
    t: TranslateFn,
    measure: LogMeasure,
    shownCurrency: string,
    displayCurrency: string
): string {
    const word = t(MEASURE_WORD_KEY[measure]);
    return shownCurrency === displayCurrency ? word : `${word} · ${shownCurrency}`;
}

/**
 * The branches of `filterDetail` that name a scope in words rather than dates.
 * A date range is left to `filterDetail`, which composes it from the calendar.
 */
export function filterScopeLabel(
    t: TranslateFn,
    filter: LogFilter,
    categoryName: string | null | undefined,
    income: boolean
): string | null {
    switch (filter) {
        case "category": {
            return categoryName || t("log.filter.category");
        }
        case "type": {
            return income ? t("log.type.income") : t("log.type.expense");
        }
        case "recurring": {
            return t("log.filter.recurring");
        }
        case "upcoming": {
            return t("log.filter.upcoming");
        }
        default: {
            return null;
        }
    }
}
