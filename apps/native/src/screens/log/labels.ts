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
	type: "log.filter.type",
	day: "log.filter.day",
	week: "log.filter.week",
	month: "log.filter.month",
	category: "log.filter.category",
	recurring: "log.filter.recurring",
	upcoming: "log.filter.upcoming",
};

export const PERIOD_PHRASE_KEY: Record<LogPeriod, TranslationKey> = {
	day: "log.period.day",
	week: "log.period.week",
	month: "log.period.month",
	year: "log.period.year",
	all: "log.period.all",
};

export const MEASURE_WORD_KEY: Record<LogMeasure, TranslationKey> = {
	net: "log.measure.net",
	in: "log.measure.in",
	out: "log.measure.out",
};

/**
 * The branches of `filterDetail` that name a scope in words rather than dates.
 * A date range is left to `filterDetail`, which composes it from the calendar.
 */
export function filterScopeLabel(
	t: TranslateFn,
	filter: LogFilter,
	categoryName: string | null | undefined,
	income: boolean,
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
