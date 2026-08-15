import { useMemo } from "react";
import { View } from "react-native";

import { DaySectionHeader } from "@/components/day-section-header";
import { EmptyState } from "@/components/empty-state";
import { Hairline } from "@/components/empty-state-parts";
import { Fade } from "@/components/mark-motion";
import { TransactionRow } from "@/components/transaction-row";
import { useDatabase } from "@/contexts/local-data-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { useNow } from "@/data/use-now";
import { useValuation } from "@/data/use-valuation";
import { groupByDay } from "@/domain/day-sections";
import { useTranslation } from "@/i18n/context";
import { useTransactionRowActions } from "@/lib/use-transaction-row-actions";
import { MARK_CEILING } from "@/theme/empty-state-ink";
import { MARK_MOTION, recedeDelay } from "@/theme/mark-motion";

interface InsightsTransactionListProps {
    currency: string;
    /** Break the list into day sections with their signed subtotals. */
    grouped?: boolean;
    onPress: (id: string) => void;
    onRequestDelete: (id: string) => void;
    /**
     * Row whose delete is waiting out its undo window, hidden from the list. Both
     * halves of the delete are the owning screen's: the toast that offers the undo
     * belongs beside its scroll container, not to content inside it, and this list
     * unmounts the moment the selection driving it is cleared — which would flush
     * the pending write before the window elapsed.
     */
    pendingDeleteId: string | null;
    transactions: TransactionWithCategory[];
}

export function InsightsTransactionList({
    transactions,
    currency,
    onPress,
    grouped = true,
    pendingDeleteId,
    onRequestDelete,
}: InsightsTransactionListProps) {
    const db = useDatabase();
    const { rates } = useValuation(db);
    const nowMs = useNow();
    const openRowActions = useTransactionRowActions(nowMs, onRequestDelete);
    const rows = useMemo(
        () => transactions.filter((transaction) => transaction.id !== pendingDeleteId),
        [transactions, pendingDeleteId]
    );
    const sections = useMemo(
        () => (grouped ? groupByDay(rows, currency, rates) : []),
        [grouped, rows, currency, rates]
    );

    if (rows.length === 0) {
        return <InsightsNoResults />;
    }

    const row = (transaction: TransactionWithCategory) => (
        <TransactionRow
            currency={currency}
            key={transaction.id}
            menuItems={openRowActions(transaction, false)}
            onPress={onPress}
            rates={rates}
            transaction={transaction}
        />
    );

    if (!grouped) {
        return <View>{rows.map(row)}</View>;
    }

    return (
        <View>
            {sections.map((section, index) => (
                <View key={section.day.getTime()}>
                    <DaySectionHeader first={index === 0} section={section} />
                    {section.data.map(row)}
                </View>
            ))}
        </View>
    );
}

function InsightsNoResults() {
    const t = useTranslation();
    return <EmptyState body={t("insights.list.empty")} mark={<RulesEmptied />} tier="inFlow" />;
}

function RulesEmptied() {
    const RULES = [1, 0.62, 0.34, 0.15];
    return (
        <View style={{ gap: 13, width: MARK_CEILING.inFlow }}>
            {RULES.map((opacity, index) => (
                <Fade delay={recedeDelay(index)} duration={MARK_MOTION.recede.duration} key={opacity} to={opacity}>
                    <Hairline />
                </Fade>
            ))}
        </View>
    );
}
