import { useMemo } from "react";
import { View } from "react-native";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ExpenseContribution } from "@/data/budget-spent";
import { buildDaySlots, dayVerdictSentence } from "@/domain/budget-day-slots";
import type { BudgetWindow } from "@/domain/budget-math";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";

interface BudgetDaySlotsProps {
	/** Draw the blocks alone, for callers that place the verdict themselves. */
	bandOnly?: boolean;
	/** Scope to one category and its subcategories; null for the overall budget. */
	categoryId?: string | null;
	compact?: boolean;
	contributions: readonly ExpenseContribution[];
	currency: string;
	limit: number;
	/** What the overflow counts — the category on a row, "purchase" for the overall budget. */
	noun?: string;
	/** `Date.now()` from the screen, so the day matches the one spend is counted in. */
	nowMs: number;
	window: BudgetWindow;
}

const BLOCK_GAP = 2;
const RULE_OVERHANG = 3;

/** Renders `buildDaySlots`: see it for why a day counts rather than measures. */
export function BudgetDaySlots({
	contributions,
	limit,
	window,
	nowMs,
	categoryId = null,
	currency,
	noun = "purchase",
	compact = false,
	bandOnly = false,
}: BudgetDaySlotsProps) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	const slots = useMemo(
		() =>
			buildDaySlots(contributions, {
				categoryId,
				limit,
				now: new Date(nowMs),
				window,
			}),
		[contributions, limit, window, nowMs, categoryId]
	);

	if (slots.scale <= 0 || (slots.blocks.length === 0 && slots.ghost == null)) {
		return null;
	}

	const span = (value: number) => `${(value / slots.scale) * 100}%` as const;
	const sentence = dayVerdictSentence(slots, noun, t);
	const sizeClass = compact ? "text-label" : "text-footnote";

	return (
		<View className={compact ? "pt-1.5" : "pt-4"}>
			<View style={{ height: compact ? 10 : 18 }}>
				{slots.blocks.map((block) => (
					<View
						key={`${block.start}-${block.amount}`}
						style={{
							bottom: 0,
							left: span(block.start),
							position: "absolute",
							top: 0,
							width: span(block.amount),
						}}
					>
						<View
							className={block.over ? "bg-over-budget" : "bg-foreground"}
							style={{ borderRadius: 2, flex: 1, marginRight: BLOCK_GAP }}
						/>
					</View>
				))}

				{slots.ghost == null ? null : (
					<View
						style={{
							bottom: 0,
							left: span(slots.spent),
							position: "absolute",
							top: 0,
							width: span(slots.ghost),
						}}
					>
						<View
							className="border-muted"
							style={{
								borderRadius: 2,
								borderStyle: "dashed",
								borderWidth: 1,
								flex: 1,
								marginRight: BLOCK_GAP,
							}}
						/>
					</View>
				)}

				<View
					className="bg-muted"
					style={{
						bottom: -RULE_OVERHANG,
						left: span(Math.min(slots.limit, slots.scale)),
						marginLeft: -1,
						position: "absolute",
						top: -RULE_OVERHANG,
						width: 1,
					}}
				/>
			</View>

			{sentence && !bandOnly ? (
				<View className="flex-row items-baseline gap-1.5 pt-2">
					<Text className={cn("text-foreground", sizeClass)}>{sentence}</Text>
					<Text className={cn("text-muted", sizeClass)}>
						{`${formatAmount(Math.abs(slots.remaining), currency, showCents)} ${
							slots.remaining < 0 ? t("budgets.suffix.over") : t("budgets.suffix.left")
						}`}
					</Text>
				</View>
			) : null}
		</View>
	);
}
