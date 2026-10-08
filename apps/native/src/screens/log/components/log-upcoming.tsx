import { useMemo } from "react";
import { View } from "react-native";

import type { ActionMenuItem } from "@/components/action-menu";
import { DayTotal } from "@/components/amount-text";
import { MonoLabel } from "@/components/mono-label";
import { TransactionRow } from "@/components/transaction-row";
import { cn } from "@/components/tw";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { landingDate } from "@/data/log-filtered";
import type { TransactionWithCategory } from "@/data/transactions";
import { currencyTotals } from "@/domain/currency-totals";
import { foldFees } from "@/domain/day-sections";
import { monthlySubscriptionCost } from "@/domain/subscription-cost";
import type { RateTable } from "@/domain/valuation";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useTranslation } from "@/i18n/context";

interface LogUpcomingProps {
    currency: string;
    /** Frozen "now", so a row's landing date does not drift mid-session. */
    nowMs: number;
    /** Builds a row's context menu. Every row here is an upcoming occurrence. */
    menuItems: (transaction: TransactionWithCategory) => readonly ActionMenuItem[];
    onPress: (id: string) => void;
    /**
     * Supplied rather than looked up, so the header converts against the same
     * currency the caller is displaying. A screen with its own currency would
     * otherwise get totals valued against the ledger-wide one.
     */
    rates: RateTable;
    /**
     * Every schedule, not only the ones `transactions` paints: the Log clips its
     * rows to the next two weeks, and a monthly cost taken over that clip is a
     * different number on the day a yearly renewal enters the window.
     */
    schedules: TransactionWithCategory[];
    transactions: TransactionWithCategory[];
}

export function LogUpcoming({ transactions, schedules, currency, rates, onPress, menuItems, nowMs }: LogUpcomingProps) {
    const { showCents } = useDisplaySettings().state;
    const now = new Date(nowMs);
    const t = useTranslation();
    const largeText = useAccessibilityTextSize();
    const headerRow = cn("flex-row items-baseline justify-between gap-2", largeText && "flex-wrap");
    const totals = useMemo(() => currencyTotals(transactions, currency, rates), [transactions, currency, rates]);
    // A second figure rather than a correction of the first: the heading total is
    // genuinely what leaves the account next, but each schedule contributes one
    // charge to it whatever its cadence, so alone it reads like a monthly cost
    // while weighing a daily coffee the same as a yearly renewal.
    const perMonth = useMemo(
        () => monthlySubscriptionCost(schedules, currency, rates, new Date(nowMs)),
        [schedules, currency, rates, nowMs]
    );
    const showPerMonth = perMonth.some((bucket) => bucket.transactionCount > 0);

    if (transactions.length === 0) {
        return null;
    }

    return (
        <View className="pb-4.5">
            <View className="gap-1.25 pt-2.5">
                <View className={headerRow}>
                    <MonoLabel>{t("log.upcoming.heading")}</MonoLabel>
                    <DayTotal showCents={showCents} sizeClass="text-body" totals={totals} />
                </View>
                <View className="bg-border" style={{ borderRadius: 0.65, height: 1.3 }} />
                {showPerMonth ? (
                    <View className={headerRow}>
                        <MonoLabel>{t("log.upcoming.perMonth")}</MonoLabel>
                        <DayTotal showCents={showCents} totals={perMonth} />
                    </View>
                ) : null}
            </View>
            {foldFees(transactions).map((transaction) => (
                <TransactionRow
                    currency={currency}
                    future
                    key={transaction.id}
                    landsOn={landingDate(transaction, now)}
                    menuItems={menuItems(transaction)}
                    onPress={onPress}
                    rates={rates}
                    transaction={transaction}
                />
            ))}
        </View>
    );
}
