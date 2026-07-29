import type { InsightsMeasure } from "@/data/insights";
import type { TranslationKey } from "@/i18n";

export const MEASURE_KEY: Record<InsightsMeasure, TranslationKey> = {
	spent: "insights.measure.spent",
	income: "insights.measure.income",
	net: "insights.measure.net",
};
