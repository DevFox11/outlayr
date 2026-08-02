import { SectionList } from "@legendapp/list/section-list";
import { type ReactNode, useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HeroNumber } from "@/components/amount-text";
import { DaySectionHeader } from "@/components/day-section-header";
import { EmptyState, useMark } from "@/components/empty-state";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { TransactionRow } from "@/components/transaction-row";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import { useValuation } from "@/data/use-valuation";
import { groupByDay } from "@/domain/day-sections";
import { formatAmount } from "@/domain/money";
import { coverageNote, coverageOf } from "@/domain/valuation-coverage";
import { useTranslation } from "@/i18n";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { UndoToast } from "@/screens/log/components/undo-toast";
import { MARK_CEILING } from "@/theme/empty-state-ink";
import { useColors } from "@/theme/use-colors";
import { BudgetProgressBar } from "./budget-progress-bar";

interface BudgetDetailViewProps {
	/** Lowercase period phrase, e.g. "this month", or a closed window's dates. */
	period: string;
	spent: number;
	amount: number;
	leftover: number;
	overBudget: boolean;
	currency: string;
	transactions: TransactionWithCategory[];
	onPressTransaction: (id: string) => void;
	/** Fraction of period time remaining, or null to hide the pace marker. */
	paceRemaining?: number | null;
	/** True when spending has outrun the clock. */
	paceBehind?: boolean;
	leftPerDayAmount?: number | null;
	/** The window has ended: nothing about it is still in play. */
	closed?: boolean;
	stepper?: ReactNode;
}

/** Matches the list hero's bleed, so both rails read as the same instrument. */
const RAIL_BLEED = 8;

/** Shared budget detail body for both the per-category and overall budgets. */
export function BudgetDetailView({
	period,
	spent,
	amount,
	leftover,
	overBudget,
	currency,
	transactions,
	onPressTransaction,
	paceRemaining = null,
	paceBehind = false,
	leftPerDayAmount = null,
	closed = false,
	stepper = null,
}: BudgetDetailViewProps) {
	const t = useTranslation();
	const db = useDatabase();
	const { displayCurrency, rates } = useValuation(db);
	const nowMs = useNow();
	const { pendingId, requestDelete, undo } = useDeferredDelete(db);
	const openRowActions = useTransactionRowActions(db, nowMs, requestDelete);
	// Only the list drops the row being deleted. The summary above it is computed
	// by the caller from the same window and catches up when the write lands, the
	// same way the Log's header trails its own list.
	const rows = useMemo(
		() => transactions.filter((row) => row.id !== pendingId),
		[transactions, pendingId],
	);
	const sections = useMemo(
		() => groupByDay(rows, currency, rates),
		[rows, currency, rates],
	);
	// Scoped to the window on screen, not the ledger: a closed period is exactly
	// where rows the rate history can no longer reach turn up, and a total that
	// silently mixes them with converted ones reads as more solid than it is.
	const note = useMemo(
		() => coverageNote(coverageOf(transactions, displayCurrency, rates), t),
		[transactions, displayCurrency, rates, t],
	);

	return (
		<>
			<SectionList
				className="flex-1 bg-background"
				contentInsetAdjustmentBehavior="automatic"
				sections={sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled={false}
				recycleItems
				contentContainerClassName="px-5 pt-2 pb-safe-offset-10"
				ListHeaderComponent={
					<BudgetSummary
						period={period}
						spent={spent}
						amount={amount}
						leftover={leftover}
						overBudget={overBudget}
						currency={currency}
						paceRemaining={paceRemaining}
						paceBehind={paceBehind}
						leftPerDayAmount={leftPerDayAmount}
						closed={closed}
						note={note}
						stepper={stepper}
					/>
				}
				ListEmptyComponent={
					<EmptyState
						body={
							closed
								? t("budgets.detail.emptyClosed")
								: t("budgets.detail.emptyOpen")
						}
						mark={<PeriodFloor closed={closed} />}
						tier="inFlow"
					/>
				}
				renderSectionHeader={({ section }) => (
					<DaySectionHeader section={section} first={sections[0] === section} />
				)}
				renderItem={({ item }) => (
					<TransactionRow
						transaction={item}
						currency={currency}
						rates={rates}
						onPress={onPressTransaction}
						onLongPress={(id) => openRowActions(id, false)}
					/>
				)}
			/>
			<UndoToast onUndo={undo} visible={pendingId != null} />
		</>
	);
}

function BudgetSummary({
	period,
	spent,
	amount,
	leftover,
	overBudget,
	currency,
	paceRemaining,
	paceBehind,
	leftPerDayAmount,
	closed,
	note,
	stepper,
}: {
	period: string;
	spent: number;
	amount: number;
	leftover: number;
	overBudget: boolean;
	currency: string;
	paceRemaining: number | null;
	paceBehind: boolean;
	leftPerDayAmount: number | null;
	closed: boolean;
	note: string | null;
	stepper: ReactNode;
}) {
	const { showCents } = useDisplaySettings().state;
	const t = useTranslation();
	const spentPct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
	const difference = Math.abs(leftover);
	const figureTone = overBudget ? "text-over-budget" : "text-foreground";
	let label: string;
	if (closed) {
		label = overBudget
			? t("budgets.detail.overBudget")
			: t("budgets.detail.unspent");
	} else {
		label = overBudget
			? t("budgets.detail.overPeriod", { period })
			: t("budgets.detail.leftPeriod", { period });
	}

	return (
		<View>
			<View className="flex-row items-baseline justify-between">
				<MonoLabel>{period}</MonoLabel>
				<MonoLabel>
					{t("budgets.detail.percentSpent", { percent: spentPct })}
				</MonoLabel>
			</View>

			<View className="pt-2">
				<HeroNumber
					amount={difference}
					code={currency}
					sign=""
					toneClass={figureTone}
					size={48}
					showCents={showCents}
				/>
			</View>
			<Text className="pt-0.5 text-footnote text-muted">{label}</Text>
			{leftPerDayAmount != null ? (
				<Text
					className="pt-0.5 text-footnote text-muted"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{t("budgets.detail.leftEachDay", {
						amount: formatAmount(leftPerDayAmount, currency, showCents),
					})}
				</Text>
			) : null}

			<View className="pt-5" style={{ marginHorizontal: -RAIL_BLEED }}>
				<BudgetProgressBar
					spent={spent}
					limit={amount}
					paceRemaining={paceRemaining}
					paceBehind={paceBehind}
					height={8}
				/>
			</View>

			<View className="flex-row items-baseline justify-between pt-2.5">
				<MonoLabel>
					{t("budgets.detail.spent", {
						amount: formatAmount(spent, currency, showCents),
					})}
				</MonoLabel>
				<MonoLabel>
					{t("budgets.detail.limit", {
						amount: formatAmount(amount, currency, showCents),
					})}
				</MonoLabel>
			</View>

			{note ? (
				<Text className="pt-3 text-footnote text-muted">{note}</Text>
			) : null}

			{stepper ? (
				<View className="mt-6 border-border border-t pt-3">{stepper}</View>
			) : null}

			<View className="pt-7">
				<MonoLabel>{t("budgets.detail.transactions")}</MonoLabel>
			</View>
		</View>
	);
}

const FLOOR_W = MARK_CEILING.inFlow;
const FLOOR_H = 40;

function PeriodFloor({ closed }: { closed: boolean }) {
	const ink = useMark();
	const colors = useColors();
	const floor = FLOOR_H - 12;
	const right = FLOOR_W - 2;
	const today = FLOOR_W * 0.55;

	return (
		<Svg height={FLOOR_H} viewBox={`0 0 ${FLOOR_W} ${FLOOR_H}`} width={FLOOR_W}>
			<Path
				d={`M4 4 V${floor} H${right}`}
				fill="none"
				stroke={ink.rule}
				strokeWidth={1}
			/>
			<Path
				d={`M4 12 H${right}`}
				stroke={ink.rule}
				strokeDasharray="2 5"
				strokeWidth={1}
			/>
			<Path
				d={`M4 ${floor} H${closed ? right : today}`}
				stroke={colors.foreground}
				strokeLinecap="round"
				strokeWidth={2}
			/>
			{closed ? (
				<Path
					d={`M4 ${floor + 5} V${floor + 10} M${right} ${floor + 5} V${floor + 10} M4 ${floor + 7.5} H${right}`}
					stroke={ink.rule}
					strokeWidth={1}
				/>
			) : (
				<>
					<Path
						d={`M${today} ${floor} H${right}`}
						stroke={ink.edge}
						strokeDasharray="4 4"
						strokeWidth={1.5}
					/>
					<Path
						d={`M${today} ${floor - 7} V${floor + 7}`}
						stroke={colors.foreground}
						strokeLinecap="round"
						strokeWidth={1.5}
					/>
				</>
			)}
		</Svg>
	);
}
