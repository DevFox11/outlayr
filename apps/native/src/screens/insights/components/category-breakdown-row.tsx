import { HugeiconsIcon } from "@hugeicons/react-native";
import { Cancel01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { Pressable, View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type { CategoryBreakdownEntry, InsightsMeasure } from "@/data/insights";
import { breakdownRiseIsFavourable } from "@/domain/insights-measure";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

interface CategoryBreakdownRowProps {
	entry: CategoryBreakdownEntry;
	measure: InsightsMeasure;
	code: string;
	showCents?: boolean;
	onPress?: () => void;
	selected?: boolean;
	dimmed?: boolean;
	onClear?: () => void;
}

export function CategoryBreakdownRow({
	entry,
	measure,
	code,
	showCents = true,
	onPress,
	selected = false,
	dimmed = false,
	onClear,
}: CategoryBreakdownRowProps) {
	const colors = useColors();
	const t = useTranslation();
	const income = measure === "income";
	const toneClass = income ? "text-income" : "text-foreground";
	const fillClass = income ? "bg-income" : "bg-foreground";
	const sign = income ? "+" : "-";
	const pct = Math.round(entry.fraction * 100);

	const body = (
		<View
			className={cn(
				"gap-2.5",
				dimmed && "opacity-40",
				selected ? "rounded-xl bg-surface-secondary p-2.5" : "py-3",
			)}
			style={
				selected ? { borderWidth: 1.3, borderColor: colors.border } : undefined
			}
		>
			<View className="flex-row items-center gap-3">
				<CategoryIconTile
					color={entry.color}
					emoji={entry.emoji}
					icon={entry.icon}
					size={34}
				/>
				<Text
					className="flex-1 font-sans-semibold text-body text-foreground"
					numberOfLines={1}
				>
					{entry.name}
				</Text>
				<Text
					className={cn("font-sans-semibold text-body", toneClass)}
					numberOfLines={1}
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{sign}
					{formatAmount(entry.amount, code, showCents)}
				</Text>
				<Text className="min-w-[34px] text-right font-mono text-label text-muted">
					{pct}%
				</Text>
				{selected && onClear ? (
					<Pressable
						accessibilityLabel={t("insights.category.clearFilter")}
						accessibilityRole="button"
						className="size-[26px] items-center justify-center rounded-full bg-surface active:opacity-70"
						hitSlop={8}
						onPress={onClear}
					>
						<HugeiconsIcon
							color={colors.muted}
							icon={Cancel01Icon}
							size={13}
							strokeWidth={2.5}
						/>
					</Pressable>
				) : (
					<DeltaCell delta={entry.delta} measure={measure} />
				)}
			</View>
			<View className="h-1 w-full overflow-hidden rounded-full bg-rail-track">
				<View
					className={cn("h-full rounded-full", fillClass)}
					style={{
						width: `${Math.max(0, Math.min(1, entry.fraction)) * 100}%`,
					}}
				/>
			</View>
		</View>
	);

	if (!onPress) {
		return body;
	}

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
		>
			{body}
		</Pressable>
	);
}

/**
 * Holds its width even when there is nothing to report, so a column of rows keeps
 * its right edge whether or not every category has history behind it.
 */
function DeltaCell({
	delta,
	measure,
}: {
	delta: number | null;
	measure: InsightsMeasure;
}) {
	if (delta == null) {
		return <View className="min-w-[46px]" />;
	}
	const rose = delta > 0;
	// Shared with `InsightsMovers` so the two cannot disagree.
	const favourable = breakdownRiseIsFavourable(measure) === rose;
	return (
		<Text
			className={cn(
				"min-w-[46px] text-right font-mono text-label",
				favourable ? "text-income" : "text-danger",
			)}
		>
			{rose ? "+" : ""}
			{Math.round(delta * 100)}%
		</Text>
	);
}
