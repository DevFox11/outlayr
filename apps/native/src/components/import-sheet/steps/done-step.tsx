import { Pressable, View } from "react-native";

import { MeasureCellAmount } from "@/components/amount-text";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";
import { MeasureStrip } from "../measure-strip";

const STAMP_BORDER_WIDTH = 1.5;
const STAMP_ROTATION = "-2deg";

interface DoneStepProps {
	onDone: () => void;
	review: ImportReviewResult;
}

export function DoneStep({ review, onDone }: DoneStepProps) {
	const t = useTranslation();
	const colors = useColors();
	const { showCents } = useDisplaySettings().state;

	if (review.commit.phase !== "success") {
		return null;
	}
	const { count, outAmount, duplicatesSkipped } = review.commit;
	const month = review.plan.latest == null ? null : review.plan.latest.toLocaleDateString(undefined, { month: "long" });

	return (
		<View className="flex-1 gap-6 px-5 pt-4">
			<View className="min-h-48 items-center justify-center gap-4">
				<View
					className="px-4 py-2"
					style={{
						borderColor: colors.income,
						borderWidth: STAMP_BORDER_WIDTH,
						transform: [{ rotate: STAMP_ROTATION }],
					}}
					testID="import-done-stamp"
				>
					<Text className="font-mono text-eyebrow text-income uppercase tracking-eyebrow">
						{t("import.doneStamp", { count })}
					</Text>
				</View>
				{month == null ? null : (
					<Text className="text-center text-footnote text-muted">
						{duplicatesSkipped > 0
							? t("import.doneSubline", { count: duplicatesSkipped, month })
							: t("import.doneSublineNoDuplicates", { month })}
					</Text>
				)}
			</View>

			<MeasureStrip
				cells={[
					{
						key: "added",
						label: t("import.doneAddedLabel"),
						value: String(count),
					},
					{
						key: "out",
						label: t("log.measure.out"),
						value: (
							<MeasureCellAmount
								code={review.currency}
								income={false}
								magnitude={outAmount}
								positive={false}
								showCents={showCents}
							/>
						),
					},
				]}
			/>

			<Pressable
				accessibilityRole="button"
				className="h-12 items-center justify-center rounded-full border border-border active:opacity-60"
				onPress={onDone}
				testID="import-done-cta"
			>
				<Text className="font-sans-medium text-body text-foreground">{t("common.done")}</Text>
			</Pressable>
		</View>
	);
}
