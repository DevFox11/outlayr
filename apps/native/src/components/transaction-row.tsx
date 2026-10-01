import PercentCircleSolidIcon from "@hugeicons-pro/core-solid-rounded/PercentCircleIcon";
import RefreshIcon from "@hugeicons-pro/core-stroke-rounded/RefreshIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { utcDateString } from "@outlayr/money/dates";
import { Pressable, View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";

import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { formatTime, formatUpcomingDate, isFuture } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { isTransactionRateNeeded } from "@/domain/transaction-entry-rate";
import { FALLBACK_IDENTITY_COLOR, resolveTransactionIdentity } from "@/domain/transaction-identity";
import type { TransferLogRow, TransferMove } from "@/domain/transfer-log-rows";
import { isExact } from "@/domain/valuation";
import type { RateTable } from "@/domain/valuation";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { ActionMenu } from "./action-menu";
import type { ActionMenuItem } from "./action-menu";
import { RowAmount } from "./amount-text";
import { CategoryIconTile } from "./category-icon-tile";
import { MonoLabel } from "./mono-label";
import { Text } from "./text";
import { BADGE_OFFSET, TILE_RADIUS, TILE_SIZE, TransferTile } from "./transfer-tile";
import { cn } from "./tw";

/** Custom, so it surfaces in the rotor's Actions rather than replacing a tap. */
const DELETE_ACTION = "delete";

function feeGlyph({ color, size }: { color: string; size: number }) {
    return <HugeiconsIcon color={color} icon={PercentCircleSolidIcon} size={size} />;
}

const UNDER_AMOUNT = "text-eyebrow text-muted font-mono tabular-nums";

interface UnderAmountProps {
    fee: { amount: number; currency: string } | undefined;
    moved: TransferMove | undefined;
    sentCurrency: string;
    showCents: boolean;
}

function UnderAmount({ fee, moved, sentCurrency, showCents }: UnderAmountProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    if (moved === undefined) {
        return fee === undefined ? null : (
            <Text className={UNDER_AMOUNT} numberOfLines={1}>
                {t("log.row.fee", { amount: formatAmount(fee.amount, fee.currency, showCents, language) })}
            </Text>
        );
    }
    const arrived = formatAmount(moved.arrived, moved.arrivedCurrency, showCents, language);
    const outside = moved.outside && (
        <Text className={UNDER_AMOUNT} numberOfLines={1}>
            {t("log.row.outside", {
                amount: formatAmount(moved.outside.amount, moved.outside.currency, showCents, language),
            })}
        </Text>
    );
    if (moved.fee === null) {
        return moved.arrivedCurrency === sentCurrency ? null : (
            <>
                <Text className={UNDER_AMOUNT} numberOfLines={1}>
                    {t("log.row.arrived", { arrived })}
                </Text>
                {outside}
            </>
        );
    }
    const charged = formatAmount(moved.fee.amount, moved.fee.currency, showCents, language);
    return (
        <>
            <Text
                accessibilityLabel={t("log.row.arrivedAfterFee", { arrived, fee: charged })}
                className={UNDER_AMOUNT}
                numberOfLines={1}
            >
                {t("log.row.arrivedFee", { arrived, fee: charged })}
            </Text>
            {outside}
        </>
    );
}

interface TransactionRowProps {
    /** Global display currency, used when the row's own currency is null. */
    currency: string;
    /**
     * Forces the upcoming variant. A scheduled entry whose stored date is already
     * past is still upcoming — what is upcoming is its next occurrence — so the
     * Upcoming section states it rather than letting the date decide.
     */
    future?: boolean;
    /** When the row lands, for the upcoming variant's subtitle. */
    landsOn?: Date;
    /**
     * The row's context menu, opened by holding it. Omit on a surface that offers
     * none.
     */
    menuItems?: readonly ActionMenuItem[];
    /**
     * Same deletion the swipe performs. Pass it on a surface whose rows swipe: a
     * pan is the one gesture assistive technology cannot make, so the action has to
     * also exist as an accessibility action.
     */
    onDelete?: (id: string) => void;
    onPress: (id: string) => void;
    /** Rates for `currency`. Without it no row is marked unplaced. */
    rates?: RateTable;
    /**
     * `details` is optional because most surfaces read a projection that leaves the
     * free text out (`LOG_COLUMNS`); only the search read carries it, and only a
     * row that has it prints the excerpt.
     */
    transaction: TransactionWithCategory & {
        details?: string | null;
        ends?: TransferLogRow["ends"];
        fee?: { amount: number; currency: string | null };
        moved?: TransferMove;
        sign?: TransferLogRow["sign"];
    };
}

export function TransactionRow({
    transaction,
    currency,
    rates,
    onPress,
    menuItems,
    onDelete,
    future: forcedFuture,
    landsOn,
}: TransactionRowProps) {
    const { showCents, swapTimeLabel, use24Hour } = useDisplaySettings().state;
    const colors = useColors();
    const t = useTranslation();
    const { language } = useLanguage();
    const date = new Date(transaction.date);
    const future = forcedFuture ?? isFuture(date);
    const code = transaction.currency ?? currency;
    const isTransfer = transaction.transferId === transaction.id;
    const isFee = transaction.feeForId != null || (transaction.transferId != null && !isTransfer);
    const identity = isFee
        ? { color: FALLBACK_IDENTITY_COLOR, emoji: null, icon: null }
        : resolveTransactionIdentity(transaction);
    const recurring = transaction.recurringType > 0;
    const rateNeeded = isTransactionRateNeeded(transaction);
    const foreignCode = transaction.currency && transaction.currency !== currency ? transaction.currency : null;
    // A row that stated no currency is printed under the global code. That is a
    // fact only while something can place it; once nothing can, the code is an
    // assumption and the mark says so.
    const unplaced =
        transaction.currency === null &&
        rates !== undefined &&
        !isExact(
            {
                amount: transaction.amount,
                amountUsd: transaction.amountUsd,
                currency: null,
                dateKey: utcDateString(date.getTime()),
            },
            currency,
            rates
        );

    const timeLabel = swapTimeLabel ? (transaction.categoryName ?? "") : formatTime(date, use24Hour, language);
    const subtitle = future ? formatUpcomingDate(landsOn ?? date, language) : timeLabel;

    const row = (
        <Pressable
            // The hold is the only route to the action menu, and nothing on screen says
            // so; the rotor entry is the only route to Delete, which otherwise lives
            // behind a swipe no assistive gesture can perform.
            accessibilityActions={
                onDelete ? [{ label: t("log.row.deleteAccessibility"), name: DELETE_ACTION }] : undefined
            }
            accessibilityHint={menuItems?.length ? t("log.row.actionsHint") : undefined}
            accessibilityRole="button"
            // The menu lifts this row into its preview, so the row carries the ground
            // it is snapshotted against rather than borrowing the list's.
            className="bg-background flex-row items-center gap-3 py-2 active:opacity-70"
            onAccessibilityAction={
                onDelete
                    ? (event: AccessibilityActionEvent) => {
                          if (event.nativeEvent.actionName === DELETE_ACTION) {
                              onDelete(transaction.id);
                          }
                      }
                    : undefined
            }
            onPress={() => onPress(transaction.id)}
        >
            {transaction.ends ? (
                <TransferTile ends={transaction.ends} future={future} />
            ) : (
                <View>
                    <CategoryIconTile
                        color={isTransfer ? colors.transfer : identity.color}
                        emoji={identity.emoji}
                        future={future}
                        glyph={isFee ? feeGlyph : undefined}
                        icon={identity.icon}
                        imageUri={transaction.imageUri}
                        radius={TILE_RADIUS}
                        size={TILE_SIZE}
                        type="solid"
                    />
                    {recurring ? (
                        <View
                            className="bg-surface-secondary absolute rounded-md"
                            style={{ bottom: BADGE_OFFSET, padding: 3, right: BADGE_OFFSET }}
                        >
                            <HugeiconsIcon color={colors.foreground} icon={RefreshIcon} size={12} strokeWidth={2} />
                        </View>
                    ) : null}
                </View>
            )}
            <View className="flex-1 gap-0.5">
                <Text
                    className={cn("font-sans-medium text-callout", future ? "text-future" : "text-foreground")}
                    numberOfLines={1}
                >
                    {transaction.note}
                </Text>
                <View className="flex-row items-center gap-1.25">
                    <Text
                        className={cn("font-sans-medium text-subtitle", future ? "text-subtle" : "text-muted")}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Text>
                    {foreignCode ? (
                        <View className="border-border rounded-[3px] border px-[3px]">
                            <MonoLabel>{foreignCode}</MonoLabel>
                        </View>
                    ) : null}
                    {unplaced ? (
                        <View
                            accessibilityLabel={t("log.row.unplaced", { code: currency })}
                            className="border-border rounded-[3px] border px-[3px]"
                        >
                            <MonoLabel className="text-subtle">{`${currency}?`}</MonoLabel>
                        </View>
                    ) : null}
                    {rateNeeded ? (
                        <View
                            accessibilityLabel={t("log.row.rateNeededAccessibility")}
                            className="border-warning rounded-[3px] border px-[3px]"
                        >
                            <MonoLabel className="text-foreground">{t("log.row.rateNeeded")}</MonoLabel>
                        </View>
                    ) : null}
                </View>
                {transaction.details ? (
                    <Text className={cn("text-footnote", future ? "text-subtle" : "text-muted")} numberOfLines={1}>
                        {transaction.details}
                    </Text>
                ) : null}
            </View>
            <View className="items-end">
                <RowAmount
                    amount={transaction.moved?.sent ?? transaction.amount}
                    code={code}
                    income={transaction.income}
                    isFuture={future}
                    showCents={showCents}
                    transfer={isTransfer}
                    transferSign={transaction.sign}
                />
                <UnderAmount
                    fee={
                        transaction.fee && {
                            amount: transaction.fee.amount,
                            currency: transaction.fee.currency ?? currency,
                        }
                    }
                    moved={transaction.moved}
                    sentCurrency={code}
                    showCents={showCents}
                />
            </View>
        </Pressable>
    );

    return menuItems?.length ? <ActionMenu items={menuItems}>{row}</ActionMenu> : row;
}
