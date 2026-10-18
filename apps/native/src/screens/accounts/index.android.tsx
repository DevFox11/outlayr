import type { MenuComponentRef } from "@expo/ui/community/menu";
import ArrowDataTransferHorizontalIcon from "@hugeicons-pro/core-stroke-rounded/ArrowDataTransferHorizontalIcon";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { isMultiCurrency } from "@outlayr/money/account-overview";
import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { ActionMenuItem } from "@/components/action-menu";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { Eyebrow, PARENT_TILE } from "@/components/category-list-chrome";
import { EmptyState } from "@/components/empty-state";
import { Tile } from "@/components/empty-state-parts";
import { useFabClearance } from "@/components/material-fab";
import { RowMenu } from "@/components/row-menu";
import { ScreenHeader } from "@/components/screen-header";
import { SwipeToDelete } from "@/components/swipe-to-delete";
import { Text } from "@/components/text";
import { toolbarIcon } from "@/components/toolbar-icons";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccountBalance, useBankAccounts } from "@/data/accounts";
import type { Account } from "@/data/accounts-core";
import { useDeferredDelete } from "@/data/use-deferred-delete";
import { useNow } from "@/data/use-now";
import type { Database } from "@/db/client";
import { formatSignedAmount } from "@/domain/account-display";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useLanguage, useTranslation } from "@/i18n/context";
import { withAlpha } from "@/theme/shade";
import type { ThemeColors } from "@/theme/use-colors";
import { useColors } from "@/theme/use-colors";
import { useMaterialColors } from "@/theme/use-material-colors";

/** Where the row's text starts, which is where its menu drops down from. */
const TEXT_LEADING = 16 + PARENT_TILE + 16;

/**
 * The accounts list on Android: M3 two-line rows on hairlines, with the same
 * census, rows and transfers entry as the iOS list. A row swipes left to
 * delete and holds for a menu; "New account" is the route's FAB.
 */
export function Accounts() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const colors = useColors();
    const all = useBankAccounts(db);
    const fabClearance = useFabClearance();
    const { pendingId, requestDelete } = useDeferredDelete("account");
    const rows = useMemo(() => all.filter((account) => account.id !== pendingId), [all, pendingId]);

    const openDetail = useCallback(
        (id: string) => {
            router.push({
                params: { accountId: id },
                pathname: "/accounts/[accountId]",
            });
        },
        [router]
    );

    const openEditor = useCallback(
        (id: string) => {
            router.push({
                params: { accountId: id },
                pathname: "/accounts/[accountId]/edit",
            });
        },
        [router]
    );

    // As on iOS: the row goes now and the write waits out the undo window, so
    // the toast carries what deleting does to the account's transactions.
    const deleteAccount = useCallback(
        (account: Account) => {
            requestDelete(account.id, t("accounts.undo.body"));
        },
        [requestDelete, t]
    );

    return (
        <>
            <ScreenHeader title={t("accounts.title")} />
            <Stack.Screen.BackButton displayMode="minimal" />
            <Stack.Toolbar placement="right">
                <Stack.Toolbar.Button
                    {...toolbarIcon("reorder")}
                    accessibilityLabel={t("accounts.a11y.reorder")}
                    hidden={rows.length <= 1}
                    onPress={() => router.push("/accounts/reorder")}
                />
            </Stack.Toolbar>
            {rows.length === 0 ? (
                <EmptyState body={t("accounts.empty")} mark={<AccountsMark />} tier="takeover" />
            ) : (
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: fabClearance }}>
                    <View className="px-4 pt-2 pb-2">
                        <Eyebrow colors={colors}>{t("accounts.census", { count: rows.length })}</Eyebrow>
                    </View>
                    {rows.map((account) => (
                        <AccountRow
                            account={account}
                            colors={colors}
                            db={db}
                            key={account.id}
                            onDelete={deleteAccount}
                            onEdit={openEditor}
                            onOpen={openDetail}
                        />
                    ))}
                    {rows.length >= 2 ? <TransfersRow /> : null}
                </ScrollView>
            )}
        </>
    );
}

const MARK_TILE = 34;
const MARK_GAP = 11;

function AccountsMark() {
    return (
        <View className="flex-row items-center" style={{ gap: MARK_GAP }}>
            <Tile opacity={1} size={MARK_TILE} />
            <Tile opacity={0.6} size={MARK_TILE} />
            <Tile opacity={0.28} size={MARK_TILE} />
        </View>
    );
}

function TransfersRow() {
    const router = useRouter();
    const t = useTranslation();
    const m3 = useMaterialColors();
    return (
        <Pressable
            accessibilityLabel={t("transfers.a11y.new")}
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(m3.onSurface, 0.1) }}
            className="bg-m3-surface mt-4 min-h-14 flex-row items-center gap-4 px-4"
            onPress={() => router.push("/transactions/transfers/create")}
        >
            <View className="items-center" style={{ width: PARENT_TILE }}>
                <HugeiconsIcon color={m3.primary} icon={ArrowDataTransferHorizontalIcon} size={22} />
            </View>
            <Text className="font-sans-medium text-body text-m3-primary">{t("transfers.title")}</Text>
        </Pressable>
    );
}

interface AccountRowProps {
    account: Account;
    colors: ThemeColors;
    db: Database;
    onDelete: (account: Account) => void;
    onEdit: (id: string) => void;
    onOpen: (id: string) => void;
}

const AccountRow = memo(({ account, colors, db, onDelete, onEdit, onOpen }: AccountRowProps) => {
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents } = useDisplaySettings().state;
    const nowMs = useNow();
    const balance = useAccountBalance(db, account, nowMs);
    const m3 = useMaterialColors();
    const menu = useRef<MenuComponentRef>(null);
    const subtitle = isMultiCurrency(balance.composition, account.currency)
        ? t("accounts.multiCurrency")
        : account.currency;
    const amount = formatSignedAmount(balance.total, account.currency, showCents, language);
    const tileColor = account.imageColor ?? account.customColor ?? colors.foreground;
    const stacked = useAccessibilityTextSize();
    const balanceTexts = (
        <>
            {balance.exact ? null : (
                <Text className="font-sans-semibold text-label text-m3-on-surface-variant">{`${account.currency}?`}</Text>
            )}
            <Text className="font-sans-medium text-body text-m3-on-surface tabular-nums" numberOfLines={1}>
                {amount}
            </Text>
        </>
    );

    const menuItems: ActionMenuItem[] = [
        { id: "edit", label: t("accounts.a11y.edit"), onPress: () => onEdit(account.id) },
        { destructive: true, id: "delete", label: t("common.delete"), onPress: () => onDelete(account) },
    ];

    return (
        <SwipeToDelete onDelete={() => onDelete(account)}>
            <Pressable
                accessibilityLabel={account.name}
                accessibilityRole="button"
                accessibilityValue={{ text: `${subtitle}, ${amount}` }}
                android_ripple={{ color: withAlpha(m3.onSurface, 0.1) }}
                className="border-m3-outline-variant bg-m3-surface min-h-18 flex-row items-center gap-4 border-b px-4 py-2"
                onLongPress={() => menu.current?.show()}
                onPress={() => onOpen(account.id)}
            >
                <CategoryIconTile
                    color={tileColor}
                    emoji={account.emoji}
                    icon={account.icon}
                    imageUri={account.imageUri}
                    size={PARENT_TILE}
                    type="solid"
                />
                {stacked ? (
                    // At accessibility sizes the balance would squeeze the name to an
                    // ellipsis, so it drops to its own line, as on iOS.
                    <View className="flex-1">
                        <Text className="text-body text-m3-on-surface">
                            {`${account.name} `}
                            <Text className="text-caption text-m3-on-surface-variant">{subtitle}</Text>
                        </Text>
                        <View className="flex-row items-center gap-2">{balanceTexts}</View>
                    </View>
                ) : (
                    <>
                        <View className="flex-1">
                            <Text className="text-body text-m3-on-surface" numberOfLines={1}>
                                {account.name}
                            </Text>
                            <Text className="text-caption text-m3-on-surface-variant" numberOfLines={1}>
                                {subtitle}
                            </Text>
                        </View>
                        {balanceTexts}
                    </>
                )}
                <RowMenu items={menuItems} leading={TEXT_LEADING} ref={menu} />
            </Pressable>
        </SwipeToDelete>
    );
});
AccountRow.displayName = "AccountRow";
