import PercentCircleSolidIcon from "@hugeicons-pro/core-solid-rounded/PercentCircleIcon";
import RefreshIcon from "@hugeicons-pro/core-stroke-rounded/RefreshIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { isFuture } from "@outlayr/money/calendar";
import { utcDateString } from "@outlayr/money/dates";
import { isTransactionRateNeeded } from "@outlayr/money/rates";
import { isExact } from "@outlayr/money/valuation";
import type { RateTable } from "@outlayr/money/valuation";
import { use } from "react";
import { View } from "react-native";
import type { AccessibilityActionEvent } from "react-native";

import { useDisplaySettings } from "@/contexts/display-settings-context";
import type { TransactionWithCategory } from "@/data/transactions";
import { formatTime, formatUpcomingDate } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { FALLBACK_IDENTITY_COLOR, resolveTransactionIdentity } from "@/domain/transaction-identity";
import type { TransferLogRow, TransferMove } from "@/domain/transfer-log-rows";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useLanguage, useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { ActionMenu } from "./action-menu";
import type { ActionMenuItem } from "./action-menu";
import { AmountsHiddenContext, RowAmount } from "./amount-text";
import { CategoryIconTile } from "./category-icon-tile";
import { MonoLabel } from "./mono-label";
import { RowPressable } from "./row-pressable";
import { ROW_TYPE } from "./row-type";
import { Text } from "./text";
import { BADGE_OFFSET, TILE_RADIUS, TILE_SIZE, TransferTile } from "./transfer-tile";
import { cn } from "./tw";

/** Custom, so it surfaces in the rotor's Actions rather than replacing a tap. */
const DELETE_ACTION = "delete";

function feeGlyph({ color, size }: { color: string; size: number }) {
    return <HugeiconsIcon color={color} icon={PercentCircleSolidIcon} size={size} />;
}

const FEE_MARK_SIZE = 14;

interface Figure {
    amount: number;
    currency: string;
}

/** A figure in the list's currency when the list could value it exactly, otherwise as it was kept. */
function inListCurrency(
    figure: { amount: number; currency: string | null; valued?: number | null },
    currency: string
): Figure {
    const kept = figure.currency ?? currency;
    return kept !== currency && figure.valued != null
        ? { amount: figure.valued, currency }
        : { amount: figure.amount, currency: kept };
}

interface UnderAmountProps {
    /** A fee the amount above could not take in, because it is in another currency. */
    fee: Figure | undefined;
    future: boolean;
    moved: TransferMove | undefined;
    /** The amount as it was kept, when the figure above restates it in the list's currency. */
    original: string | null;
    sentCurrency: string;
    showCents: boolean;
}

/** The trailing figure's second line, in the type of the time beside it. */
function UnderAmount({ fee, future, moved, original, sentCurrency, showCents }: UnderAmountProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    if (use(AmountsHiddenContext)) {
        return null;
    }
    const className = cn(ROW_TYPE.subtitle, "tabular-nums", future ? "text-subtle" : "text-muted");
    if (moved === undefined) {
        return (
            <>
                {original === null ? null : (
                    <Text className={className} numberOfLines={1}>
                        {original}
                    </Text>
                )}
                {fee === undefined ? null : (
                    <Text className={className} numberOfLines={1}>
                        {t("log.row.fee", { amount: formatAmount(fee.amount, fee.currency, showCents, language) })}
                    </Text>
                )}
            </>
        );
    }
    if (moved.fee === null && moved.arrivedCurrency === sentCurrency) {
        return null;
    }
    const arrived = formatAmount(moved.arrived, moved.arrivedCurrency, showCents, language);
    return (
        <>
            <Text
                accessibilityLabel={
                    moved.fee === null
                        ? t("log.row.arrived", { arrived })
                        : t("log.row.arrivedAfterFee", {
                              arrived,
                              fee: formatAmount(moved.fee.amount, moved.fee.currency, showCents, language),
                          })
                }
                className={className}
                numberOfLines={1}
            >
                {`→ ${arrived}`}
            </Text>
            {moved.outside ? (
                <Text className={className} numberOfLines={1}>
                    {t("log.row.outside", {
                        amount: formatAmount(moved.outside.amount, moved.outside.currency, showCents, language),
                    })}
                </Text>
            ) : null}
        </>
    );
}

interface RowMetaProps {
    currency: string;
    details: string | null | undefined;
    /** Marks a row whose figure carries a fee. */
    fee: boolean;
    foreignCode: string | null;
    future: boolean;
    rateNeeded: boolean;
    /** The trailing figure restates the row in the list's currency, with the original under it. */
    restated: boolean;
    subtitle: string;
    unplaced: boolean;
}

function RowMeta({
    currency,
    details,
    fee,
    foreignCode,
    future,
    rateNeeded,
    restated,
    subtitle,
    unplaced,
}: RowMetaProps) {
    const t = useTranslation();
    const colors = useColors();
    const showOriginal = restated && !use(AmountsHiddenContext);
    return (
        <>
            <View className="flex-row flex-wrap items-center gap-1.25">
                <Text className={cn(ROW_TYPE.subtitle, future ? "text-subtle" : "text-muted")} numberOfLines={1}>
                    {subtitle}
                </Text>
                {fee ? (
                    <View accessibilityLabel={t("log.row.feeIncluded")}>
                        <HugeiconsIcon
                            color={future ? colors.subtle : colors.muted}
                            icon={PercentCircleSolidIcon}
                            size={FEE_MARK_SIZE}
                        />
                    </View>
                ) : null}
                {foreignCode && !showOriginal ? (
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
            {details ? (
                <Text className={cn("text-footnote", future ? "text-subtle" : "text-muted")} numberOfLines={1}>
                    {details}
                </Text>
            ) : null}
        </>
    );
}

interface RowFigure extends Figure {
    /** A fee the figure could not take in, because it is in another currency. */
    apart?: Figure;
    feeIn: boolean;
    /** `amount` with the fee taken in. */
    total: number;
}

/** The row's trailing figure, and the fee it carries. */
function rowFigure(transaction: TransactionRowProps["transaction"], currency: string, isTransfer: boolean): RowFigure {
    const fee = transaction.fee && inListCurrency(transaction.fee, currency);
    if (isTransfer) {
        // A transfer keeps the currency it left in: what arrived, and in what, is the row's point.
        const sent = transaction.moved?.sent ?? transaction.amount;
        return { amount: sent, apart: fee, currency: transaction.currency ?? currency, feeIn: false, total: sent };
    }
    const shown = inListCurrency(transaction, currency);
    if (fee?.currency !== shown.currency) {
        return { ...shown, apart: fee, feeIn: false, total: shown.amount };
    }
    // Taken in, so a day's rows add up to its header.
    return { ...shown, feeIn: true, total: shown.amount + (transaction.income ? -fee.amount : fee.amount) };
}

interface TransactionRowProps {
    /**
     * The list's currency: a row kept in another one is restated in it, and a row
     * that stated none is printed under it.
     */
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
        fee?: { amount: number; currency: string | null; valued?: number | null };
        moved?: TransferMove;
        sign?: TransferLogRow["sign"];
        valued?: number | null;
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
    const stacked = useAccessibilityTextSize();
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
    const shown = rowFigure(transaction, currency, isTransfer);
    const kept = formatAmount(transaction.amount, code, showCents, language);
    const original =
        shown.currency === code || formatAmount(shown.amount, code, showCents, language) === kept ? null : kept;
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

    const amount = (
        <View className={stacked ? "items-start" : "items-end"}>
            <RowAmount
                amount={shown.total}
                code={shown.currency}
                income={transaction.income}
                isFuture={future}
                showCents={showCents}
                transfer={isTransfer}
                transferSign={transaction.sign}
            />
            <UnderAmount
                fee={shown.apart}
                future={future}
                moved={transaction.moved}
                original={original}
                sentCurrency={code}
                showCents={showCents}
            />
        </View>
    );

    const row = (
        <RowPressable
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
            className={cn("bg-background flex-row gap-3 py-2", stacked ? "items-start" : "items-center")}
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
                    className={cn(ROW_TYPE.title, future ? "text-future" : "text-foreground")}
                    numberOfLines={stacked ? 2 : 1}
                >
                    {transaction.note}
                </Text>
                {stacked ? amount : null}
                <RowMeta
                    currency={currency}
                    details={transaction.details}
                    fee={shown.feeIn || transaction.moved?.fee != null}
                    foreignCode={foreignCode}
                    future={future}
                    rateNeeded={rateNeeded}
                    restated={original !== null}
                    subtitle={subtitle}
                    unplaced={unplaced}
                />
            </View>
            {stacked ? null : amount}
        </RowPressable>
    );

    return menuItems?.length ? <ActionMenu items={menuItems}>{row}</ActionMenu> : row;
}
