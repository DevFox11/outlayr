import { Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";

import { EmptyState, useMark } from "@/components/empty-state";
import { Text } from "@/components/text";
import type { Burndown } from "@/domain/budget-burndown";
import { useTranslation } from "@/i18n";
import { MARK_CEILING } from "@/theme/empty-state-ink";
import { useColors } from "@/theme/use-colors";
import { BudgetLimitPicker } from "./budget-limit-picker";

interface BudgetEmptyStateProps {
	/** Month-to-date burn-down built with `limit: 0` — the curve to place a limit on. */
	burndown: Burndown;
	/** How many expenses are behind the curve. */
	sampleSize: number;
	currency: string;
	windowStart: Date;
	onAddTransaction: () => void;
	onCommit: (limit: number) => void;
}

export function BudgetEmptyState({
	burndown,
	sampleSize,
	currency,
	windowStart,
	onAddTransaction,
	onCommit,
}: BudgetEmptyStateProps) {
	if (sampleSize === 0) {
		return <NothingToBudget onAddTransaction={onAddTransaction} />;
	}

	return (
		<BudgetLimitPicker
			burndown={burndown}
			currency={currency}
			onCommit={onCommit}
			sampleSize={sampleSize}
			windowStart={windowStart}
		/>
	);
}

function NothingToBudget({
	onAddTransaction,
}: {
	onAddTransaction: () => void;
}) {
	const t = useTranslation();
	return (
		<EmptyState
			action={
				<Pressable
					accessibilityRole="button"
					className="rounded-full bg-accent px-7 py-3.5 active:opacity-80"
					onPress={onAddTransaction}
				>
					<Text className="font-sans-semibold text-accent-foreground text-body">
						{t("budgets.empty.action")}
					</Text>
				</Pressable>
			}
			body={t("budgets.empty.body")}
			mark={<PlotUnset />}
			tier="takeover"
			title={t("budgets.empty.title")}
		/>
	);
}

const PLOT_W = MARK_CEILING.takeover;
const PLOT_H = 128;

function PlotUnset() {
	const ink = useMark();
	const colors = useColors();
	return (
		<Svg height={PLOT_H} viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} width={PLOT_W}>
			<Path
				d={`M14 6 V${PLOT_H - 16} H${PLOT_W - 4}`}
				fill="none"
				stroke={ink.rule}
				strokeWidth={1.5}
			/>
			<Path
				d={`M14 30 H${PLOT_W - 4}`}
				fill="none"
				stroke={ink.edge}
				strokeDasharray="6 6"
				strokeWidth={2}
			/>
			<Path
				d={`M14 ${(PLOT_H - 16 + 30) / 2} H${PLOT_W - 4}`}
				fill="none"
				stroke={ink.rule}
				strokeDasharray="2 7"
				strokeWidth={1}
			/>
			<Path
				d={`M14 ${PLOT_H - 16} H${PLOT_W - 4}`}
				stroke={colors.foreground}
				strokeLinecap="round"
				strokeWidth={3}
			/>
		</Svg>
	);
}
