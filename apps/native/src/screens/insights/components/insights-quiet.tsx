import { View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import type { InsightsMeasure, InsightsPeriod } from "@/data/insights";
import { type TranslationKey, useTranslation } from "@/i18n";
import { MEASURE_KEY } from "../measure-label";

export { quietAlternative } from "@/domain/insights-quiet";

/** Matches the chart's plot height, so promoting a quiet measure never jumps. */
const PLOT_HEIGHT = 150;

const PERIOD_PHRASE_KEY: Record<InsightsPeriod, TranslationKey> = {
	week: "insights.quiet.thisWeek",
	month: "insights.quiet.thisMonth",
	year: "insights.quiet.thisYear",
};

interface InsightsQuietProps {
	measure: InsightsMeasure;
	alternative: InsightsMeasure | null;
	period: InsightsPeriod;
}

export function InsightsQuiet({
	measure,
	alternative,
	period,
}: InsightsQuietProps) {
	const t = useTranslation();
	const phrase = t(PERIOD_PHRASE_KEY[period]);
	const sentence = alternative
		? t("insights.quiet.alternative", {
				measure: t(MEASURE_KEY[alternative]),
				period: phrase,
			})
		: t("insights.quiet.empty", { period: phrase });

	return (
		<View>
			<View className="h-px w-full bg-border" />
			<View
				// The visible copy never names the measure that went quiet, so on its
				// own a screen reader hears "Nothing to chart" with no subject.
				accessibilityLabel={t("insights.quiet.accessibility", {
					measure: t(MEASURE_KEY[measure]),
					period: phrase,
					sentence,
				})}
				accessible
				className="items-center justify-center"
				style={{ height: PLOT_HEIGHT }}
			>
				<MonoLabel>{t("insights.quiet.title")}</MonoLabel>
				<Text className="max-w-60 pt-1.5 text-center text-footnote text-muted">
					{sentence}
				</Text>
			</View>
			<View className="h-px w-full bg-border" />
		</View>
	);
}
