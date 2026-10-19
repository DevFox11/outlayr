import { Host } from "@expo/ui";
import { HStack, Image, List, RNHostView, Section, Spacer, Text as SwiftText, VStack } from "@expo/ui/swift-ui";
import {
    accessibilityAddTraits,
    accessibilityElement,
    accessibilityLabel,
    accessibilityValue,
    font,
    foregroundStyle,
    lineLimit,
    monospacedDigit,
    onTapGesture,
} from "@expo/ui/swift-ui/modifiers";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useState } from "react";
import { View } from "react-native";

import { AccountTile } from "@/components/account-tile";
import { Eyebrow, PARENT_TILE } from "@/components/category-list-chrome";
import { LABEL, PARENT_NAME } from "@/components/category-list-swift";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { groupedList, groupedRows } from "@/components/native/styles";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useDebtsOverview } from "@/data/debts";
import type { DebtsScreenOverview } from "@/data/debts";
import { DUE_WINDOW_DAYS } from "@/data/debts-due";
import { useNow } from "@/data/use-now";
import { formatSignedAmount } from "@/domain/account-display";
import { formatSentenceDate } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { useLanguage, useTranslation } from "@/i18n/context";
import { hitArea, outline } from "@/lib/swift-ui-geometry";
import { useColors } from "@/theme/use-colors";
import type { ThemeColors } from "@/theme/use-colors";

type DebtListRow = DebtsScreenOverview["youOwe"][number];

const TOTAL_LABEL = font({ design: "rounded", textStyle: "subheadline" });
const TOTAL = font({ design: "rounded", textStyle: "title2", weight: "semibold" });
const SUBTITLE = font({ design: "rounded", textStyle: "subheadline" });
const AMOUNT = font({ design: "rounded", textStyle: "subheadline", weight: "medium" });
const APPROX = font({ design: "rounded", textStyle: "caption", weight: "semibold" });
const CHEVRON = font({ design: "rounded", textStyle: "footnote", weight: "semibold" });

/**
 * Everything owed, both ways: what is due in the next 14 days, liability
 * accounts and people you owe, then the people who owe you, then the settled
 * people folded under one row. Every row opens its account, which for a person
 * is the person detail.
 */
export function Debts() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const colors = useColors();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const currency = useGlobalCurrency(db);
    const debts = useDebtsOverview(db, useNow());
    const [settledOpen, setSettledOpen] = useState(false);
    const rowGround = groupedRows(colors);
    const format = (amount: number) => formatSignedAmount(amount, currency, showCents, language);

    const open = useCallback(
        (id: string) => router.push({ params: { accountId: id }, pathname: "/accounts/[accountId]" }),
        [router]
    );

    const header = (
        <>
            <Stack.Header transparent />
            <Stack.Screen.Title>{t("debts.title")}</Stack.Screen.Title>
            <Stack.Screen.BackButton displayMode="minimal" />
        </>
    );

    if (debts.youOwe.length + debts.owedToYou.length + debts.settled.length === 0) {
        return (
            <>
                {header}
                <EmptyState body={t("debts.empty")} mark={<DebtsMark />} tier="takeover" />
            </>
        );
    }

    // A liability with orders says its next cuota, in its own currency, flagged when
    // overdue; otherwise only what the figure does not already say: the account keeps
    // another currency.
    const subtitle = (item: DebtListRow): string | null => {
        const orders = debts.installments.get(item.id);
        if (orders === undefined) {
            return item.account.currency === currency ? null : item.account.currency;
        }
        const [only, ...others] = orders.open;
        const { overdue } = orders.next;
        const date = formatSentenceDate(orders.next.row.dueDate, language);
        const next = {
            amount: formatAmount(orders.next.remaining, item.account.currency, showCents, language),
            date: overdue ? `${date} · ${t("installments.overdue")}` : date,
        };
        return only && others.length === 0
            ? t(overdue ? "debts.overdue.of" : "debts.next.of", {
                  ...next,
                  paid: only.standing.installmentsPaid,
                  total: only.standing.installmentsTotal,
              })
            : t(overdue ? "debts.overdue.orders" : "debts.next.orders", { ...next, count: orders.open.length });
    };
    // An overdue cuota reads as an expense; otherwise the one the due row names is tinted.
    const subtitleColor = (item: DebtListRow): string => {
        if (debts.installments.get(item.id)?.next.overdue) {
            return colors.expense;
        }
        return item.id === debts.due?.next.accountId ? colors.tint : colors.muted;
    };
    const row = (item: DebtListRow) => (
        <DebtRow
            colors={colors}
            currency={currency}
            format={format}
            key={item.id}
            onOpen={open}
            row={item}
            subtitle={subtitle(item)}
            subtitleColor={subtitleColor(item)}
        />
    );
    const total = (label: string, amount: number) => (
        <VStack
            alignment="leading"
            modifiers={[accessibilityElement("combine"), accessibilityLabel(label), accessibilityValue(format(amount))]}
            spacing={2}
        >
            <SwiftText modifiers={[TOTAL_LABEL, foregroundStyle(colors.muted)]}>{label}</SwiftText>
            <SwiftText modifiers={[TOTAL, monospacedDigit(), lineLimit(1), foregroundStyle(LABEL)]}>
                {format(amount)}
            </SwiftText>
        </VStack>
    );

    return (
        <>
            {header}
            <Host style={{ flex: 1 }} useViewportSizeMeasurement>
                <List modifiers={groupedList(colors)}>
                    <Section modifiers={[rowGround]}>
                        <HStack alignment="top" spacing={16}>
                            {total(t("debts.youOwe"), debts.youOweTotal)}
                            <Spacer />
                            {total(t("debts.owedToYou"), debts.owedToYouTotal)}
                        </HStack>
                        {debts.exact ? null : (
                            <SwiftText modifiers={[APPROX, foregroundStyle(colors.subtle)]}>{`${currency}?`}</SwiftText>
                        )}
                        {debts.due === null ? null : (
                            <DueRow
                                colors={colors}
                                currency={currency}
                                due={debts.due}
                                format={format}
                                name={debts.youOwe.find((item) => item.id === debts.due?.next.accountId)?.account.name}
                            />
                        )}
                    </Section>
                    {debts.youOwe.length > 0 ? (
                        <Section
                            header={<Eyebrow colors={colors}>{t("debts.youOwe")}</Eyebrow>}
                            modifiers={[rowGround]}
                        >
                            {debts.youOwe.map(row)}
                        </Section>
                    ) : null}
                    {debts.owedToYou.length > 0 ? (
                        <Section
                            header={<Eyebrow colors={colors}>{t("debts.owedToYou")}</Eyebrow>}
                            modifiers={[rowGround]}
                        >
                            {debts.owedToYou.map(row)}
                        </Section>
                    ) : null}
                    {debts.settled.length > 0 ? (
                        <Section modifiers={[rowGround]}>
                            <HStack
                                modifiers={[
                                    hitArea(outline.rectangle()),
                                    onTapGesture(() => setSettledOpen((current) => !current)),
                                    accessibilityElement("combine"),
                                    accessibilityAddTraits(["isButton"]),
                                ]}
                                spacing={12}
                            >
                                <SwiftText modifiers={[foregroundStyle(colors.muted)]}>
                                    {t("debts.settled", { count: debts.settled.length })}
                                </SwiftText>
                                <Spacer />
                                <Image
                                    color={colors.muted}
                                    modifiers={[CHEVRON]}
                                    systemName={settledOpen ? "chevron.down" : "chevron.right"}
                                />
                            </HStack>
                            {settledOpen ? debts.settled.map(row) : null}
                        </Section>
                    ) : null}
                </List>
            </Host>
        </>
    );
}

const MARK_TILE = 34;

function DebtsMark() {
    return (
        <View className="flex-row items-center" style={{ gap: 11 }}>
            <Tile opacity={1} size={MARK_TILE} />
            <Tile opacity={0.28} size={MARK_TILE} />
        </View>
    );
}

interface DueRowProps {
    colors: ThemeColors;
    currency: string;
    due: NonNullable<DebtsScreenOverview["due"]>;
    format: (amount: number) => string;
    /** The account the soonest cuota is owed to. */
    name: string | undefined;
}

/**
 * "Due in the next 14 days", how many cuotas and the soonest, and what they come
 * to. When the soonest is overdue it says since when, in the expense colour.
 */
function DueRow({ colors, currency, due, format, name }: DueRowProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const title = t("debts.due.title", { days: DUE_WINDOW_DAYS });
    const { overdue } = due.next.standing;
    const summary = t(overdue ? "debts.due.overdue" : "debts.due.summary", {
        count: due.count,
        date: formatSentenceDate(due.next.standing.row.dueDate, language),
        name: name ?? t("installments.order"),
    });

    return (
        <HStack
            modifiers={[
                accessibilityElement("combine"),
                accessibilityLabel(`${title}, ${summary}`),
                accessibilityValue(format(due.total)),
            ]}
            spacing={12}
        >
            <VStack alignment="leading" spacing={2}>
                <SwiftText modifiers={[TOTAL_LABEL, foregroundStyle(colors.muted)]}>{title}</SwiftText>
                <SwiftText modifiers={[SUBTITLE, lineLimit(2), foregroundStyle(overdue ? colors.expense : LABEL)]}>
                    {summary}
                </SwiftText>
            </VStack>
            <Spacer />
            {due.exact ? null : (
                <SwiftText modifiers={[APPROX, foregroundStyle(colors.subtle)]}>{`${currency}?`}</SwiftText>
            )}
            <SwiftText modifiers={[AMOUNT, monospacedDigit(), lineLimit(1), foregroundStyle(LABEL)]}>
                {format(due.total)}
            </SwiftText>
        </HStack>
    );
}

interface DebtRowProps {
    colors: ThemeColors;
    currency: string;
    format: (amount: number) => string;
    onOpen: (id: string) => void;
    row: DebtListRow;
    subtitle: string | null;
    subtitleColor: string;
}

const DebtRow = memo(({ colors, currency, format, onOpen, row, subtitle, subtitleColor }: DebtRowProps) => {
    const { account } = row;

    return (
        <HStack
            modifiers={[
                hitArea(outline.rectangle()),
                onTapGesture(() => onOpen(account.id)),
                accessibilityElement("combine"),
                accessibilityAddTraits(["isButton"]),
                accessibilityLabel(subtitle === null ? account.name : `${account.name}, ${subtitle}`),
                accessibilityValue(format(row.amount)),
            ]}
            spacing={12}
        >
            <RNHostView matchContents>
                <View style={{ height: PARENT_TILE, width: PARENT_TILE }}>
                    <AccountTile account={account} size={PARENT_TILE} />
                </View>
            </RNHostView>
            <VStack alignment="leading" spacing={1}>
                <SwiftText modifiers={[PARENT_NAME, lineLimit(1), foregroundStyle(LABEL)]}>{account.name}</SwiftText>
                {subtitle === null ? null : (
                    <SwiftText modifiers={[SUBTITLE, lineLimit(2), foregroundStyle(subtitleColor)]}>
                        {subtitle}
                    </SwiftText>
                )}
            </VStack>
            <Spacer />
            {row.exact ? null : (
                <SwiftText modifiers={[APPROX, foregroundStyle(colors.subtle)]}>{`${currency}?`}</SwiftText>
            )}
            <SwiftText modifiers={[AMOUNT, monospacedDigit(), lineLimit(1), foregroundStyle(LABEL)]}>
                {format(row.amount)}
            </SwiftText>
            <Image color={colors.muted} modifiers={[CHEVRON]} systemName="chevron.right" />
        </HStack>
    );
});
DebtRow.displayName = "DebtRow";
