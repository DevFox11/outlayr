import ArrowDown01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons-pro/core-stroke-rounded/ArrowUp01Icon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountTile } from "@/components/account-tile";
import { Eyebrow, PARENT_TILE } from "@/components/category-list-chrome";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { ScreenHeader } from "@/components/screen-header";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import { useDebtsOverview } from "@/data/debts";
import type { DebtsScreenOverview } from "@/data/debts";
import { useNow } from "@/data/use-now";
import { formatSignedAmount } from "@/domain/account-display";
import { useLanguage, useTranslation } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import { useColors } from "@/theme/use-colors";
import { useMaterialColors } from "@/theme/use-material-colors";

type DebtListRow = DebtsScreenOverview["youOwe"][number];

const PRESSED_ALPHA = 0.1;

/**
 * The Debts screen on Android: the two totals, then M3 two-line rows on
 * hairlines under the same sections as iOS (you owe, owed to you, and the
 * settled people folded under one row). Every row opens its account, which
 * for a person is the person detail. The route's "+" menu stays in the app bar.
 */
export function Debts() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const currency = useGlobalCurrency(db);
    const debts = useDebtsOverview(db, useNow());
    const [settledOpen, setSettledOpen] = useState(false);
    const format = useCallback(
        (amount: number) => formatSignedAmount(amount, currency, showCents, language),
        [currency, showCents, language]
    );

    const open = useCallback(
        (id: string) => router.push({ params: { accountId: id }, pathname: "/accounts/[accountId]" }),
        [router]
    );

    const header = (
        <>
            <ScreenHeader title={t("debts.title")} />
            <Stack.Screen.BackButton displayMode="minimal" />
        </>
    );

    if (debts.youOwe.length + debts.owedToYou.length + debts.settled.length === 0) {
        return (
            <View className="bg-m3-surface flex-1">
                {header}
                <EmptyState body={t("debts.empty")} mark={<DebtsMark />} tier="takeover" />
            </View>
        );
    }

    const row = (item: DebtListRow) => (
        <DebtRow currency={currency} format={format} key={item.id} onOpen={open} row={item} />
    );
    const section = (title: string, rows: readonly DebtListRow[]) =>
        rows.length === 0 ? null : (
            <>
                <View className="px-4 pt-4 pb-2">
                    <Eyebrow colors={colors}>{title}</Eyebrow>
                </View>
                {rows.map(row)}
            </>
        );

    return (
        <View className="bg-m3-surface flex-1">
            {header}
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                <View className="flex-row gap-4 px-4 pt-2 pb-2">
                    <Total amount={format(debts.youOweTotal)} label={t("debts.youOwe")} />
                    <Total amount={format(debts.owedToYouTotal)} end label={t("debts.owedToYou")} />
                </View>
                {debts.exact ? null : (
                    <Text className="font-sans-semibold text-label text-m3-on-surface-variant px-4">{`${currency}?`}</Text>
                )}
                {section(t("debts.youOwe"), debts.youOwe)}
                {section(t("debts.owedToYou"), debts.owedToYou)}
                {debts.settled.length > 0 ? (
                    <>
                        <SettledToggle
                            count={debts.settled.length}
                            onToggle={() => setSettledOpen((current) => !current)}
                            open={settledOpen}
                        />
                        {settledOpen ? debts.settled.map(row) : null}
                    </>
                ) : null}
            </ScrollView>
        </View>
    );
}

function Total({ amount, end = false, label }: { amount: string; end?: boolean; label: string }) {
    return (
        <View
            accessibilityLabel={label}
            accessibilityValue={{ text: amount }}
            accessible
            className={end ? "flex-1 items-end" : "flex-1"}
        >
            <Text className="text-caption text-m3-on-surface-variant">{label}</Text>
            <Text className="font-sans-semibold text-title text-m3-on-surface tabular-nums" numberOfLines={1}>
                {amount}
            </Text>
        </View>
    );
}

function SettledToggle({ count, onToggle, open }: { count: number; onToggle: () => void; open: boolean }) {
    const t = useTranslation();
    const m3 = useMaterialColors();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            android_ripple={{ color: withAlpha(m3.onSurface, PRESSED_ALPHA) }}
            className="border-m3-outline-variant mt-4 min-h-14 flex-row items-center gap-4 border-b px-4"
            onPress={onToggle}
        >
            <Text className="text-body text-m3-on-surface-variant flex-1">{t("debts.settled", { count })}</Text>
            <HugeiconsIcon color={m3.onSurfaceVariant} icon={open ? ArrowUp01Icon : ArrowDown01Icon} size={20} />
        </Pressable>
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

interface DebtRowProps {
    currency: string;
    format: (amount: number) => string;
    onOpen: (id: string) => void;
    row: DebtListRow;
}

const DebtRow = memo(({ currency, format, onOpen, row }: DebtRowProps) => {
    const m3 = useMaterialColors();
    const { account } = row;
    // Only what the figure does not already say: the account keeps another currency.
    const subtitle = account.currency === currency ? null : account.currency;
    const amount = format(row.amount);

    return (
        <Pressable
            accessibilityLabel={account.name}
            accessibilityRole="button"
            accessibilityValue={{ text: subtitle === null ? amount : `${subtitle}, ${amount}` }}
            android_ripple={{ color: withAlpha(m3.onSurface, PRESSED_ALPHA) }}
            className="border-m3-outline-variant bg-m3-surface min-h-18 flex-row items-center gap-4 border-b px-4 py-2"
            onPress={() => onOpen(account.id)}
        >
            <AccountTile account={account} size={PARENT_TILE} />
            <View className="flex-1">
                <Text className="text-body text-m3-on-surface" numberOfLines={1}>
                    {account.name}
                </Text>
                {subtitle === null ? null : (
                    <Text className="text-caption text-m3-on-surface-variant" numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {row.exact ? null : (
                <Text className="font-sans-semibold text-label text-m3-on-surface-variant">{`${currency}?`}</Text>
            )}
            <Text className="font-sans-medium text-body text-m3-on-surface tabular-nums" numberOfLines={1}>
                {amount}
            </Text>
        </Pressable>
    );
});
DebtRow.displayName = "DebtRow";
