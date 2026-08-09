import type { LogPeriod } from "@/data/log-totals";
import type { LogFilter } from "@/domain/log-filter";
import type { LogMeasure } from "@/domain/log-measure";
import type { TranslateFn, TranslationKey } from "@/i18n";

/**
 * The domain modules keep their labels as module-level constants, which resolve
 * once at import and so cannot follow a language change. Screens name the copy
 * through these keys instead and leave the constants to non-visual callers.
 */
export const FILTER_LABEL_KEY: Record<LogFilter, TranslationKey> = {
	all: "log.filter.all",
	category: "log.filter.category",
	day: "log.filter.day",
	month: "log.filter.month",
	recurring: "log.filter.recurring",
	type: "log.filter.type",
	upcoming: "log.filter.upcoming",
	week: "log.filter.week",
};

export const PERIOD_PHRASE_KEY: Record<LogPeriod, TranslationKey> = {
	all: "log.period.all",
	day: "log.period.day",
	month: "log.period.month",
	week: "log.period.week",
	year: "log.period.year",
};

export const MEASURE_WORD_KEY: Record<LogMeasure, TranslationKey> = {
	in: "log.measure.in",
	net: "log.measure.net",
	out: "log.measure.out",
};

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
		case "category":
			return categoryName || t("log.filter.category");
		case "type":
			return income ? t("log.type.income") : t("log.type.expense");
		case "recurring":
			return t("log.filter.recurring");
		case "upcoming":
			return t("log.filter.upcoming");
		default:
			return null;
	}
}
