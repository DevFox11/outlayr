import { View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import type { InsightsMeasure, InsightsPeriod } from "@/data/insights";
import { INSIGHTS_MEASURE_WORD } from "@/domain/insights-measure";

export { quietAlternative } from "@/domain/insights-quiet";

/** Matches the chart's plot height, so promoting a quiet measure never jumps. */
const PLOT_HEIGHT = 150;

const PERIOD_PHRASE: Record<InsightsPeriod, string> = {
	week: "this week",
	month: "this month",
	year: "this year",
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
	const phrase = PERIOD_PHRASE[period];
	const sentence = alternative
		? `${INSIGHTS_MEASURE_WORD[alternative]} has ${phrase} covered — tap it above.`
		: `Nothing logged ${phrase}.`;

	return (
		<View>
			<View className="h-px w-full bg-border" />
			<View
				// The visible copy never names the measure that went quiet, so on its
				// own a screen reader hears "Nothing to chart" with no subject.
				accessibilityLabel={`${INSIGHTS_MEASURE_WORD[measure]} has nothing to chart ${phrase}. ${sentence}`}
				accessible
				className="items-center justify-center"
				style={{ height: PLOT_HEIGHT }}
			>
				<MonoLabel>Nothing to chart</MonoLabel>
				<Text className="max-w-60 pt-1.5 text-center text-footnote text-muted">
					{sentence}
				</Text>
			</View>
			<View className="h-px w-full bg-border" />
		</View>
	);
}
