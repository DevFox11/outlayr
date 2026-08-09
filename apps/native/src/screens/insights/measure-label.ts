import type { InsightsMeasure } from "@/data/insights";
import type { TranslationKey } from "@/i18n";

export const MEASURE_KEY: Record<InsightsMeasure, TranslationKey> = {
	income: "insights.measure.income",
	net: "insights.measure.net",
	spent: "insights.measure.spent",
};
