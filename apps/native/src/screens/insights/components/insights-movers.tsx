import { View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type { CategoryMover, InsightsMeasure } from "@/data/insights";
import { breakdownRiseIsFavourable } from "@/domain/insights-measure";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";

interface InsightsMoversProps {
	movers: readonly CategoryMover[];
	measure: InsightsMeasure;
	/** What the window is being compared against, e.g. "2025". */
	priorLabel: string;
	code: string;
	showCents?: boolean;
}

export function InsightsMovers({
	movers,
	measure,
	priorLabel,
	code,
	showCents = true,
}: InsightsMoversProps) {
	const t = useTranslation();

	if (movers.length === 0) {
		return null;
	}

	return (
		<View>
			<View className="flex-row items-baseline justify-between pb-1">
				<MonoLabel>{t("insights.movers.title")}</MonoLabel>
				<MonoLabel>
					{t("insights.movers.versus", { label: priorLabel })}
				</MonoLabel>
			</View>
			{movers.map((mover) => (
				<MoverRow
					code={code}
					key={mover.id}
					measure={measure}
					mover={mover}
					showCents={showCents}
				/>
			))}
		</View>
	);
}

function MoverRow({
	mover,
	measure,
	code,
	showCents,
}: {
	mover: CategoryMover;
	measure: InsightsMeasure;
	code: string;
	showCents: boolean;
}) {
	const t = useTranslation();
	const rose = mover.delta > 0;
	// Shared with `CategoryBreakdownRow` directly below, so the two cannot disagree.
	const favourable = breakdownRiseIsFavourable(measure) === rose;
	const toneClass = favourable ? "text-income" : "text-danger";

	return (
		<View className="flex-row items-center gap-2.5 py-1.5">
			<CategoryIconTile
				color={mover.color}
				emoji={mover.emoji}
				icon={mover.icon}
				size={26}
			/>
			<Text
				className="flex-1 font-sans-medium text-caption text-foreground"
				numberOfLines={1}
			>
				{mover.name}
			</Text>
			<Text
				className={cn("font-sans-medium text-caption", toneClass)}
				numberOfLines={1}
				style={{ fontVariant: ["tabular-nums"] }}
			>
				{rose ? "+" : "-"}
				{formatAmount(Math.abs(mover.delta), code, showCents)}
			</Text>
			<Text className="min-w-[46px] text-right font-mono text-label text-muted">
				{mover.fraction == null
					? t("insights.movers.new")
					: `${mover.fraction > 0 ? "+" : ""}${Math.round(mover.fraction * 100)}%`}
			</Text>
		</View>
	);
}
