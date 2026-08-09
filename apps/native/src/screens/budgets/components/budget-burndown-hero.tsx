import { useMemo, useState } from "react";
import { type LayoutChangeEvent, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { HeroNumber } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { ExpenseContribution } from "@/data/budget-spent";
import type { MainBudgetView } from "@/data/budgets";
import type { Burndown } from "@/domain/budget-burndown";
import { BUDGET_TYPE, budgetPeriodPhrase, budgetTimeLeftLabel } from "@/domain/budget-math";
import { monthAbbrev } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { useTranslation } from "@/i18n";
import { BudgetBurndownChart } from "./budget-burndown-chart";
import { BudgetDaySlots } from "./budget-day-slots";

interface BudgetBurndownHeroProps {
	/** How far the chart reaches past the screen's text gutter. */
	bleed?: number;
	budget: MainBudgetView;
	burndown: Burndown | null;
	contributions: readonly ExpenseContribution[];
	currency: string;
	/** `Date.now()` from the screen, so the clock tracks the same instant as spend. */
	nowMs: number;
	onPress: () => void;
}

const CHART_HEIGHT = 168;

/** "23 Jul". */
function formatDayMonth(date: Date): string {
	return `${date.getDate()} ${monthAbbrev(date)}`;
}

function dayDate(start: Date, day: number): Date {
	return new Date(start.getFullYear(), start.getMonth(), start.getDate() + day - 1);
}

export function BudgetBurndownHero({
	budget,
	burndown,
	contributions,
	currency,
	onPress,
	nowMs,
	bleed = 8,
}: BudgetBurndownHeroProps) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	const { width: windowWidth } = useWindowDimensions();
	const [measured, setMeasured] = useState(0);
	const [scrubDay, setScrubDay] = useState<number | null>(null);

	const now = new Date(nowMs);
	const period = t(budgetPeriodPhrase(budget.type));
	const isDay = budget.type === BUDGET_TYPE.day;
	const showChart = burndown != null && !isDay;

	const scrubbed = scrubDay == null ? null : (burndown?.points[scrubDay - 1] ?? null);
	const balance = scrubbed ? scrubbed.balance : budget.leftover;
	const over = balance < 0;
	const scrubLabel = scrubbed ? formatDayMonth(dayDate(budget.window.start, scrubbed.day)) : null;

	// Already crossed zero is not the same question as will it, so both are asked.
	const projected = burndown?.projectedBalance ?? null;
	const endsShort = projected != null && projected < 0;
	let runwayLabel: string | null = null;
	if (!isDay) {
		runwayLabel = t("budgets.hero.onTrack");
		if (burndown?.runwayDate != null) {
			runwayLabel = t("budgets.hero.ranOut", {
				date: formatDayMonth(burndown.runwayDate).toUpperCase(),
			});
		} else if (endsShort && projected != null) {
			runwayLabel = t("budgets.hero.endsShort", {
				amount: formatAmount(Math.abs(projected), currency, false),
			});
		}
	}

	const balanceLabel = formatAmount(Math.abs(balance), currency, showCents);
	const status = over ? t("budgets.hero.overBudget") : t("budgets.hero.leftPeriod", { period });

	const chartWidth = measured > 0 ? measured + bleed * 2 : windowWidth - 24;

	const openDetail = useMemo(
		() =>
			Gesture.Tap().onEnd((_event, success) => {
				"worklet";
				if (success) {
					scheduleOnRN(onPress);
				}
			}),
		[onPress]
	);

	const onLayout = (event: LayoutChangeEvent) => {
		setMeasured(event.nativeEvent.layout.width);
	};

	return (
		<View>
			{/* A tap gesture rather than a Pressable: the chart inside runs its own
			    pan, and RN's touch responder and RNGH cannot arbitrate between them —
			    the pan claims every touch and the card stops opening. Two gestures in
			    one system sort themselves out, pan on movement, tap on stillness. */}
			<GestureDetector gesture={openDetail}>
				<View
					accessibilityLabel={
						over
							? t("budgets.hero.a11yOver", {
									amount: balanceLabel,
									name: budget.name,
								})
							: t("budgets.hero.a11yLeft", {
									amount: balanceLabel,
									name: budget.name,
									period,
								})
					}
					accessibilityRole="button"
				>
					<View onLayout={onLayout}>
						<View className="flex-row items-baseline justify-between">
							<MonoLabel>{t("budgets.hero.eyebrow", { period: period.toUpperCase() })}</MonoLabel>
							<MonoLabel>
								{scrubLabel
									? scrubLabel.toUpperCase()
									: budgetTimeLeftLabel(budget.window, budget.type, now, t).toUpperCase()}
							</MonoLabel>
						</View>

						<View className="pt-2">
							<HeroNumber
								amount={Math.abs(balance)}
								code={currency}
								showCents={showCents}
								sign=""
								size={40}
								toneClass={over ? "text-over-budget" : "text-foreground"}
							/>
						</View>
						<Text className="pt-0.5 text-footnote text-muted">
							{scrubLabel ? t("budgets.hero.onDate", { date: scrubLabel, label: status }) : status}
						</Text>
					</View>

					{showChart && burndown ? (
						<View className="pt-4" style={{ marginHorizontal: -bleed }}>
							<BudgetBurndownChart
								burndown={burndown}
								height={CHART_HEIGHT}
								limit={budget.amount}
								onScrub={setScrubDay}
								width={chartWidth}
							/>
						</View>
					) : null}

					{isDay ? (
						<BudgetDaySlots
							contributions={contributions}
							currency={currency}
							limit={budget.amount}
							nowMs={nowMs}
							window={budget.window}
						/>
					) : null}

					<View className="flex-row items-baseline justify-between pt-2.5">
						<MonoLabel>{formatAmount(budget.amount, currency, false)}</MonoLabel>
						{runwayLabel ? <MonoLabel>{runwayLabel}</MonoLabel> : null}
					</View>
				</View>
			</GestureDetector>

			{scrubbed || isDay ? null : <HeroVerdict burndown={burndown} currency={currency} periodEndsShort={endsShort} />}
		</View>
	);
}

function HeroVerdict({
	burndown,
	currency,
	periodEndsShort,
}: {
	burndown: Burndown | null;
	currency: string;
	periodEndsShort: boolean;
}) {
	const t = useTranslation();
	if (!burndown) {
		return null;
	}

	let sentence: string | null = null;
	if (burndown.runwayDate && burndown.runwayDay != null) {
		const ranOut = formatDayMonth(burndown.runwayDate);
		const early = burndown.totalDays - burndown.runwayDay;
		sentence =
			early > 0
				? t("budgets.hero.verdictRanOutEarly", {
						date: ranOut,
						days: t("budgets.days", { count: early }),
					})
				: t("budgets.hero.verdictRanOutFinal", { date: ranOut });
	} else if (periodEndsShort && burndown.projectedBalance != null) {
		sentence = t("budgets.hero.verdictEndsShort", {
			amount: formatAmount(Math.abs(burndown.projectedBalance), currency, false),
		});
	}

	if (!sentence) {
		return null;
	}

	return <Text className="px-1 pt-2.5 text-footnote text-muted">{sentence}</Text>;
}
