import { and, eq, isNull } from "drizzle-orm";
import { Button } from "panelui-native";
import { useState } from "react";
import { View } from "react-native";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { MonoLabel } from "@/components/mono-label";
import { SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useAccounts } from "@/data/accounts";
import { useGlobalCurrency } from "@/data/app-meta";
import { META_KEYS, setMeta } from "@/data/app-meta-core";
import { useLiveQuery, useLiveValue } from "@/data/live-query";
import { parseLastWalletEntry } from "@/data/pending-writes-core";
import type { Database } from "@/db/client";
import { appMeta, transactions } from "@/db/schema";
import { formatChargeDate, formatTime } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import type { TranslationKey } from "@/i18n/catalog";
import { useLanguage, useTranslation } from "@/i18n/context";
import { notifyFailure } from "@/lib/notify";
import { openShortcutsAutomations, openWalletShortcut, WALLET_SHORTCUT_URL } from "@/lib/wallet-shortcut";
import { useColors } from "@/theme/use-colors";

const TABULAR = { fontVariant: ["tabular-nums" as const] };
const TILE_SIZE = 30;
const TILE_RADIUS = 8;

interface Step {
    detail?: TranslationKey;
    title: TranslationKey;
}

/** The automation, once the shared shortcut is installed. */
const AUTOMATION_STEPS: readonly Step[] = [
    { title: "settings.wallet.step1" },
    { detail: "settings.wallet.step2Detail", title: "settings.wallet.step2" },
    { detail: "settings.wallet.step3Detail", title: "settings.wallet.step3" },
    { title: "settings.wallet.step4" },
    { title: "settings.wallet.step5" },
];

/**
 * The same automation with the shortcut built by hand, for as long as there is
 * no shared link. Step 4 changes: instead of picking the installed shortcut
 * the user creates one around the intent and binds its three fields.
 */
const MANUAL_STEPS: readonly Step[] = [
    ...AUTOMATION_STEPS.slice(0, 3),
    { title: "settings.wallet.manualStep1" },
    { title: "settings.wallet.manualStep2" },
    { title: "settings.wallet.manualStep3" },
    { title: "settings.wallet.step5" },
];

export function Wallet() {
    const db = useDatabase();
    return <WalletSettings db={db} />;
}

function WalletSettings({ db }: { db: Database }) {
    const t = useTranslation();
    const added = useLiveValue(
        appMeta,
        () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.walletShortcutAdded)),
        (rows) => rows[0]?.value === "1"
    );
    const last = useLiveValue(
        appMeta,
        () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.lastWalletEntry)),
        (rows) => rows[0]?.value ?? null
    );
    const lastEntry = parseLastWalletEntry(last);
    const [stepsShown, setStepsShown] = useState(false);
    const working = lastEntry != null;
    const steps = WALLET_SHORTCUT_URL == null ? MANUAL_STEPS : AUTOMATION_STEPS;

    const getShortcut = async () => {
        try {
            await openWalletShortcut();
            await setMeta(db, META_KEYS.walletShortcutAdded, "1");
        } catch (cause) {
            console.error("Opening the Wallet shortcut failed", cause);
            notifyFailure({ title: t("settings.wallet.get") });
        }
    };

    if (!added) {
        return (
            <SettingsScreen>
                <View className="gap-5 pt-6">
                    <Text className="text-muted text-body leading-snug">{t("settings.wallet.lead")}</Text>
                    <Button className="rounded-full" fullWidth onPress={getShortcut} size="md" variant="primary">
                        {t("settings.wallet.get")}
                    </Button>
                    <Text className="text-muted text-subtitle leading-snug">{t("settings.wallet.getDetail")}</Text>
                </View>
                <AccountsSection db={db} />
            </SettingsScreen>
        );
    }

    return (
        <SettingsScreen>
            {working ? <LastEntry db={db} txId={lastEntry.txId} /> : null}

            <SettingsSection title={t(working ? "settings.wallet.setupSection" : "settings.wallet.stepsSection")}>
                <CheckRow detail={t("settings.wallet.shortcutName")} title={t("settings.wallet.installed")} />
                {working ? (
                    <ToggleStepsRow onPress={() => setStepsShown((shown) => !shown)} shown={stepsShown} />
                ) : null}
                {working && !stepsShown
                    ? null
                    : steps.map((step, index) => (
                          <StepRow
                              detail={step.detail ? t(step.detail) : undefined}
                              key={step.title}
                              number={index + 1}
                              title={t(step.title)}
                          />
                      ))}
            </SettingsSection>

            <View className="gap-2.5 pt-5">
                <Button
                    className="rounded-full"
                    fullWidth
                    onPress={openShortcutsAutomations}
                    size="md"
                    variant={working ? "outline" : "primary"}
                >
                    {t("settings.wallet.open")}
                </Button>
                {working ? (
                    <Button className="rounded-full" fullWidth onPress={getShortcut} size="md" variant="ghost">
                        {t("settings.wallet.getAgain")}
                    </Button>
                ) : null}
            </View>

            {working ? null : (
                <View className="gap-1.5 pt-6">
                    <MonoLabel>{t("settings.wallet.lastSection")}</MonoLabel>
                    <Text className="text-foreground text-title">{t("settings.wallet.nothingYet")}</Text>
                    <Text className="text-muted text-subtitle">{t("settings.wallet.tryIt")}</Text>
                </View>
            )}

            <AccountsSection db={db} />
        </SettingsScreen>
    );
}

/** The most recent row the automation produced, as proof it works. */
function LastEntry({ db, txId }: { db: Database; txId: string }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { showCents, use24Hour } = useDisplaySettings().state;
    const ledgerCurrency = useGlobalCurrency(db);
    const accounts = useAccounts(db);
    const rows = useLiveQuery(
        transactions,
        () =>
            db
                .select({
                    accountId: transactions.accountId,
                    amount: transactions.amount,
                    currency: transactions.currency,
                    date: transactions.date,
                    note: transactions.note,
                })
                .from(transactions)
                .where(and(eq(transactions.id, txId), isNull(transactions.deletedAt)))
                .limit(1),
        [txId]
    );
    const [row] = rows;
    if (!row) {
        // Deleted, or erased: the next purchase writes a fresh pointer.
        return null;
    }
    const account = accounts.find((candidate) => candidate.id === row.accountId);
    const when = `${formatChargeDate(row.date, undefined, language)} ${formatTime(row.date, use24Hour, language)}`;
    const parts = [row.note, account?.name ?? t("settings.wallet.unattached"), when];

    return (
        <View className="gap-1.5 pt-6">
            <MonoLabel>{t("settings.wallet.lastSection")}</MonoLabel>
            <Text className="text-foreground text-title" style={TABULAR}>
                {formatAmount(row.amount, row.currency ?? ledgerCurrency, showCents, language)}
            </Text>
            <Text className="text-muted text-subtitle" numberOfLines={2}>
                {parts.join(" · ")}
            </Text>
        </View>
    );
}

/**
 * Every live account with its currency: the only lever the user has over the
 * card match is what they name the account.
 */
function AccountsSection({ db }: { db: Database }) {
    const t = useTranslation();
    const colors = useColors();
    const accounts = useAccounts(db);

    return (
        <SettingsSection footer={t("settings.wallet.accountsFooter")} title={t("settings.wallet.accountsSection")}>
            {accounts.length === 0 ? (
                <Text className="text-muted text-body py-3.5">{t("settings.wallet.noAccounts")}</Text>
            ) : (
                accounts.map((account) => (
                    <View className="border-border flex-row items-center gap-3 border-b py-3" key={account.id}>
                        <CategoryIconTile
                            color={account.imageColor ?? account.customColor ?? colors.foreground}
                            emoji={account.emoji}
                            icon={account.icon}
                            imageUri={account.imageUri}
                            radius={TILE_RADIUS}
                            size={TILE_SIZE}
                            type="solid"
                        />
                        <Text className="text-body text-foreground flex-1" numberOfLines={1}>
                            {account.name}
                        </Text>
                        <Text className="text-body text-muted">{account.currency}</Text>
                    </View>
                ))
            )}
        </SettingsSection>
    );
}

function StepRow({ number, title, detail }: { detail?: string; number: number; title: string }) {
    return (
        <View className="border-border flex-row gap-3 border-b py-3">
            <Text className="text-muted text-subtitle w-4 pt-0.5 font-mono" style={TABULAR}>
                {String(number)}
            </Text>
            <View className="flex-1">
                <Text className="text-body text-foreground">{title}</Text>
                {detail ? <Text className="text-muted text-subtitle leading-snug">{detail}</Text> : null}
            </View>
        </View>
    );
}

function CheckRow({ title, detail }: { detail: string; title: string }) {
    return (
        <View className="border-border flex-row items-center gap-3 border-b py-3">
            <View className="bg-income h-5.5 w-5.5 items-center justify-center rounded-full">
                <Text className="text-background text-eyebrow font-sans-semibold">✓</Text>
            </View>
            <Text className="text-body text-foreground flex-1" numberOfLines={1}>
                {title}
            </Text>
            <Text className="text-body text-muted">{detail}</Text>
        </View>
    );
}

function ToggleStepsRow({ shown, onPress }: { onPress: () => void; shown: boolean }) {
    const t = useTranslation();
    return (
        <Text
            accessibilityRole="button"
            className="border-border text-body text-foreground border-b py-3"
            onPress={onPress}
            suppressHighlighting
        >
            {t("settings.wallet.automationRow")}
            <Text className="text-muted">{`  ${t(shown ? "settings.wallet.hide" : "settings.wallet.show")} ›`}</Text>
            {"\n"}
            <Text className="text-muted text-subtitle">{t("settings.wallet.automationDetail")}</Text>
        </Text>
    );
}
