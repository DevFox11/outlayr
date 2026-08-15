import { SectionList } from "@legendapp/list/section-list";
import { useMemo } from "react";
import type { ReactNode } from "react";
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
import { useLanguage, useTranslation } from "@/i18n/context";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { MARK_CEILING } from "@/theme/empty-state-ink";
import { useColors } from "@/theme/use-colors";

import { BudgetProgressBar } from "./budget-progress-bar";

interface BudgetDetailViewProps {
    amount: number;
    /** The window has ended: nothing about it is still in play. */
    closed?: boolean;
    currency: string;
    leftover: number;
    leftPerDayAmount?: number | null;
    onPressTransaction: (id: string) => void;
    overBudget: boolean;
    /** True when spending has outrun the clock. */
    paceBehind?: boolean;
    /** Fraction of period time remaining, or null to hide the pace marker. */
    paceRemaining?: number | null;
    /** Lowercase period phrase, e.g. "this month", or a closed window's dates. */
    period: string;
    spent: number;
    stepper?: ReactNode;
    /** The budget's category colour for the rail; omitted by the overall budget. */
    tint?: string | null;
    transactions: TransactionWithCategory[];
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
    tint = null,
}: BudgetDetailViewProps) {
    const t = useTranslation();
    const db = useDatabase();
    const { displayCurrency, rates } = useValuation(db);
    const nowMs = useNow();
    const { pendingId, requestDelete } = useDeferredDelete("row");
    const openRowActions = useTransactionRowActions(nowMs, requestDelete);
    // Only the list drops the row being deleted. The summary above it is computed
    // by the caller from the same window and catches up when the write lands, the
    // same way the Log's header trails its own list.
    const rows = useMemo(() => transactions.filter((row) => row.id !== pendingId), [transactions, pendingId]);
    const sections = useMemo(() => groupByDay(rows, currency, rates), [rows, currency, rates]);
    // Scoped to the window on screen, not the ledger: a closed period is exactly
    // where rows the rate history can no longer reach turn up, and a total that
    // silently mixes them with converted ones reads as more solid than it is.
    const note = useMemo(
        () => coverageNote(coverageOf(transactions, displayCurrency, rates), t),
        [transactions, displayCurrency, rates, t]
    );

    return (
        <SectionList
            className="bg-background flex-1"
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
                    tint={tint}
                />
            }
            ListEmptyComponent={
                <EmptyState
                    body={closed ? t("budgets.detail.emptyClosed") : t("budgets.detail.emptyOpen")}
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
                    menuItems={openRowActions(item, false)}
                />
            )}
        />
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
    tint,
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
    tint: string | null;
}) {
    const { showCents } = useDisplaySettings().state;
    const t = useTranslation();
    const { language } = useLanguage();
    const spentPct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
    const difference = Math.abs(leftover);
    const figureTone = overBudget ? "text-over-budget" : "text-foreground";
    let label: string;
    if (closed) {
        label = overBudget ? t("budgets.detail.overBudget") : t("budgets.detail.unspent");
    } else {
        label = overBudget ? t("budgets.detail.overPeriod", { period }) : t("budgets.detail.leftPeriod", { period });
    }

    return (
        <View>
            <View className="flex-row items-baseline justify-between">
                <MonoLabel>{period}</MonoLabel>
                <MonoLabel>{t("budgets.detail.percentSpent", { percent: spentPct })}</MonoLabel>
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
            <Text className="text-footnote text-muted pt-0.5">{label}</Text>
            {leftPerDayAmount == null ? null : (
                <Text className="text-footnote text-muted pt-0.5" style={{ fontVariant: ["tabular-nums"] }}>
                    {t("budgets.detail.leftEachDay", {
                        amount: formatAmount(leftPerDayAmount, currency, showCents, language),
                    })}
                </Text>
            )}

            <View className="pt-5" style={{ marginHorizontal: -RAIL_BLEED }}>
                <BudgetProgressBar
                    spent={spent}
                    limit={amount}
                    paceRemaining={paceRemaining}
                    paceBehind={paceBehind}
                    height={8}
                    tint={tint}
                />
            </View>

            <View className="flex-row items-baseline justify-between pt-2.5">
                <MonoLabel>
                    {t("budgets.detail.spent", {
                        amount: formatAmount(spent, currency, showCents, language),
                    })}
                </MonoLabel>
                <MonoLabel>
                    {t("budgets.detail.limit", {
                        amount: formatAmount(amount, currency, showCents, language),
                    })}
                </MonoLabel>
            </View>

            {note ? <Text className="text-footnote text-muted pt-3">{note}</Text> : null}

            {stepper ? <View className="border-border mt-6 border-t pt-3">{stepper}</View> : null}

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
            <Path d={`M4 4 V${floor} H${right}`} fill="none" stroke={ink.rule} strokeWidth={1} />
            <Path d={`M4 12 H${right}`} stroke={ink.rule} strokeDasharray="2 5" strokeWidth={1} />
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
