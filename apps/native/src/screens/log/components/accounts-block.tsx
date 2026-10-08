import { use } from "react";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AmountsHiddenContext } from "@/components/amount-text";
import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { cn } from "@/components/tw";
import type { Account } from "@/data/accounts-core";
import type { AccountsOverview, OverviewRow } from "@/domain/account-display";
import { formatSignedAmount } from "@/domain/account-display";
import { maskedAmount } from "@/domain/money";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useLanguage, useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/languages";
import { useColors } from "@/theme/use-colors";

/** The Log row's tile, so an account reads at the same weight as an entry. */
const TILE_SIZE = 36;
const TILE_RADIUS = 9;
/**
 * How many rows the block spends before it points at the accounts screen. A
 * ledger one over the cap gives up a row to the pointer rather than growing.
 */
const MAX_ROWS = 4;

interface AccountsBlockProps {
    /** The live account rows, in ledger order. Names and marks come from here. */
    accounts: readonly Account[];
    /** The display currency every figure is valued in. */
    currency: string;
    onOpen: (accountId: string) => void;
    onOpenAll: () => void;
    /** Null hides the block entirely — no accounts, no ghost heading. */
    overview: AccountsOverview | null;
    showCents: boolean;
    trailing?: ReactNode;
}

/**
 * The accounts as they stand, under the week's net and above the day groups.
 *
 * One hairline row per account with its balance in the display currency. A
 * liability says "Owed" under its name, and its figure is muted and stated
 * positive, so it cannot be read as an expense line among the entries below.
 */
export function AccountsBlock({
    accounts,
    overview,
    currency,
    showCents,
    onOpen,
    onOpenAll,
    trailing,
}: AccountsBlockProps) {
    const t = useTranslation();
    const { language } = useLanguage();
    const hidden = use(AmountsHiddenContext);
    const stacked = useAccessibilityTextSize();
    if (overview == null) {
        return null;
    }

    const total = hidden ? maskedAmount(currency) : formatSignedAmount(overview.total, currency, showCents, language);

    const byId = new Map(accounts.map((account) => [account.id, account]));
    const overflow = overview.rows.length > MAX_ROWS;
    const shown = overflow ? overview.rows.slice(0, MAX_ROWS - 1) : overview.rows;

    return (
        <View className="gap-1.25 pt-2.5 pb-4.5">
            <View className="flex-row items-center gap-2">
                <Pressable
                    accessibilityHint={t("accounts.overview.openHint")}
                    accessibilityLabel={`${t("accounts.overview.heading")} · ${overview.count}`}
                    accessibilityRole="button"
                    accessibilityValue={{ text: hidden ? t("log.amounts.hidden") : total }}
                    className={cn(
                        "flex-1 active:opacity-70",
                        stacked ? "gap-0.75" : "flex-row items-baseline justify-between gap-2"
                    )}
                    onPress={onOpenAll}
                    testID="accounts-overview-card"
                >
                    <MonoLabel>{`${t("accounts.overview.heading")} · ${overview.count}  ›`}</MonoLabel>
                    <View className="flex-row items-baseline gap-1.5">
                        {overview.exact ? null : <MonoLabel className="text-subtle">{`${currency}?`}</MonoLabel>}
                        <Text className="font-sans-semibold text-body text-muted tabular-nums" numberOfLines={1}>
                            {total}
                        </Text>
                    </View>
                </Pressable>
                {trailing}
            </View>
            {shown.map((row) => {
                const account = byId.get(row.id);
                return account ? (
                    <AccountRow
                        account={account}
                        currency={currency}
                        key={row.id}
                        language={language}
                        onPress={() => onOpen(row.id)}
                        row={row}
                        showCents={showCents}
                    />
                ) : null;
            })}
            {overflow ? (
                <Pressable accessibilityRole="button" className="py-2 active:opacity-70" onPress={onOpenAll}>
                    <MonoLabel className="text-tint">
                        {t("accounts.overview.more", { count: overview.rows.length - shown.length })}
                    </MonoLabel>
                </Pressable>
            ) : null}
            <View className="bg-border" style={{ borderRadius: 0.65, height: 1.3 }} />
        </View>
    );
}

/** Only what the display-currency chip does not already say: a debt, a mix, or another currency. */
function rowSubtitle(
    row: OverviewRow,
    accountCurrency: string,
    displayCurrency: string,
    t: ReturnType<typeof useTranslation>
): string | null {
    if (row.kind === "liability") {
        return t("accounts.overview.owed");
    }
    if (row.multiCurrency) {
        return t("accounts.multiCurrency");
    }
    return accountCurrency === displayCurrency ? null : accountCurrency;
}

interface AccountRowProps {
    account: Account;
    currency: string;
    language: Language;
    onPress: () => void;
    row: OverviewRow;
    showCents: boolean;
}

function AccountRow({ account, row, currency, showCents, language, onPress }: AccountRowProps) {
    const t = useTranslation();
    const colors = useColors();
    const owed = row.kind === "liability";
    const subtitle = rowSubtitle(row, account.currency, currency, t);
    // A debt is stated as what is owed, not as a negative holding: the entries
    // right below are negative expenses in the same column.
    const hidden = use(AmountsHiddenContext);
    const figure = hidden
        ? maskedAmount(currency)
        : formatSignedAmount(owed ? -row.balance : row.balance, currency, showCents, language);
    const tileColor = account.imageColor ?? account.customColor ?? colors.foreground;
    const stacked = useAccessibilityTextSize();
    const balance = (
        <>
            {row.exact ? null : <MonoLabel className="text-subtle">{`${currency}?`}</MonoLabel>}
            <Text
                className={cn("font-sans-medium text-callout tabular-nums", owed ? "text-muted" : "text-foreground")}
                numberOfLines={1}
            >
                {figure}
            </Text>
        </>
    );

    return (
        <Pressable
            accessibilityLabel={[account.name, subtitle, hidden ? t("log.amounts.hidden") : figure]
                .filter((part) => part !== null)
                .join(", ")}
            accessibilityRole="button"
            className={cn("flex-row gap-3 py-2 active:opacity-70", stacked ? "items-start" : "items-center")}
            onPress={onPress}
        >
            <CategoryIconTile
                color={tileColor}
                emoji={account.emoji}
                icon={account.icon}
                imageUri={account.imageUri}
                radius={TILE_RADIUS}
                size={TILE_SIZE}
                type="solid"
            />
            <View className="flex-1 gap-0.5">
                <Text className="font-sans-medium text-callout text-foreground" numberOfLines={stacked ? 2 : 1}>
                    {account.name}
                </Text>
                {stacked ? <View className="flex-row items-baseline gap-1.5">{balance}</View> : null}
                {subtitle === null ? null : (
                    <Text className="font-sans-medium text-subtitle text-muted" numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {stacked ? null : balance}
        </Pressable>
    );
}
