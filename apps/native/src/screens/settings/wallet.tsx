import { and, eq, isNull } from "drizzle-orm";
import { Image } from "expo-image";
import { Button, Carousel } from "panelui-native";
import { useState } from "react";
import { Platform, View } from "react-native";
import type { ImageRequireSource } from "react-native";

import boundFrame from "@/assets/images/recipe/bound.jpg";
import newShortcutFrame from "@/assets/images/recipe/new-shortcut.jpg";
import pickerFrame from "@/assets/images/recipe/picker.jpg";
import triggersFrame from "@/assets/images/recipe/triggers.jpg";
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
import type { LastWalletEntry } from "@/data/pending-writes-core";
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
    /** A frame of the Shortcuts screen this step happens on, for the strip. */
    frame?: ImageRequireSource;
    title: TranslationKey;
}

/**
 * Built inline on iOS 26: the action goes straight into a blank automation,
 * and the trigger's Wallet transaction is the "Shortcut Input" its three
 * fields are read from. The action lives in the OutlayrIntents extension,
 * which only ever surfaces inside the action picker and under Library › Apps.
 */
const MANUAL_STEPS: readonly Step[] = [
    { title: "settings.wallet.step1" },
    { detail: "settings.wallet.step2Detail", title: "settings.wallet.step2" },
    { detail: "settings.wallet.step3Detail", title: "settings.wallet.step3" },
    { title: "settings.wallet.manualStep1" },
    { detail: "settings.wallet.manualStep2Detail", title: "settings.wallet.manualStep2" },
    { detail: "settings.wallet.manualStep3Detail", title: "settings.wallet.manualStep3" },
    { title: "settings.wallet.step5" },
];

/** iOS 27 keeps a shortcut's triggers inside it, so a shared link installs the whole automation. */
const TRIGGERS_IN_SHORTCUTS = Number.parseInt(String(Platform.Version), 10) >= 27;

const IOS27_AUTOMATION_STEPS: readonly Step[] = [
    { detail: "settings.wallet.v27Step1Detail", title: "settings.wallet.v27Step1" },
    { title: "settings.wallet.v27Step2" },
];

const IOS27_MANUAL_STEPS: readonly Step[] = [
    { frame: newShortcutFrame, title: "settings.wallet.v27Manual1" },
    { detail: "settings.wallet.v27Manual2Detail", frame: triggersFrame, title: "settings.wallet.v27Manual2" },
    { detail: "settings.wallet.manualStep2Detail", frame: pickerFrame, title: "settings.wallet.manualStep2" },
    { detail: "settings.wallet.manualStep3Detail27", frame: boundFrame, title: "settings.wallet.manualStep3" },
    { title: "settings.wallet.step5" },
];

const NOTIFICATION_STEPS: readonly Step[] = [
    { frame: newShortcutFrame, title: "settings.wallet.v27Manual1" },
    { detail: "settings.wallet.notifStep2Detail", frame: triggersFrame, title: "settings.wallet.notifStep2" },
    { detail: "settings.wallet.notifStep3Detail", frame: pickerFrame, title: "settings.wallet.manualStep2" },
    { detail: "settings.wallet.notifStep4Detail", title: "settings.wallet.notifStep4" },
    { detail: "settings.wallet.notifStep5Detail", title: "settings.wallet.notifStep5" },
    { title: "settings.wallet.step5" },
];

/** The shared shortcut carries an iOS 27 trigger, so only iOS 27 gets the one-tap install. */
const HAS_SHARED_SHORTCUT = WALLET_SHORTCUT_URL != null && TRIGGERS_IN_SHORTCUTS;

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
    const lastRunAt = useLiveValue(
        appMeta,
        () => db.select().from(appMeta).where(eq(appMeta.key, META_KEYS.walletLastRunAt)),
        (rows) => (rows[0]?.value ? Number(rows[0].value) : null)
    );
    const [stepsShown, setStepsShown] = useState(false);
    const working = lastEntry != null || lastRunAt != null;
    // What this user's automation actually runs. `added` is only ever set by the
    // shared link, so a setup built inline before the link shipped stays inline.
    const linked = HAS_SHARED_SHORTCUT && added;
    const inline = TRIGGERS_IN_SHORTCUTS ? IOS27_MANUAL_STEPS : MANUAL_STEPS;
    const steps = linked ? IOS27_AUTOMATION_STEPS : inline;

    const getShortcut = async () => {
        try {
            await openWalletShortcut();
            await setMeta(db, META_KEYS.walletShortcutAdded, "1");
        } catch (cause) {
            console.error("Opening the Wallet shortcut failed", cause);
            notifyFailure({ title: t("settings.wallet.get") });
        }
    };

    // A working inline setup is done, whatever `added` says: the link may ship
    // in a later build, and it must not bounce those users back to the Get button.
    if (HAS_SHARED_SHORTCUT && !added && !working) {
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
            <Proof db={db} lastEntry={lastEntry} lastRunAt={lastRunAt} />

            <SettingsSection title={t(working ? "settings.wallet.setupSection" : "settings.wallet.stepsSection")}>
                {linked ? (
                    <CheckRow detail={t("settings.wallet.shortcutName")} title={t("settings.wallet.installed")} />
                ) : null}
                {working ? (
                    <ToggleStepsRow
                        linked={linked}
                        onPress={() => setStepsShown((shown) => !shown)}
                        shown={stepsShown}
                    />
                ) : null}
                {working && !stepsShown ? null : <StepList steps={steps} />}
            </SettingsSection>

            {TRIGGERS_IN_SHORTCUTS && (!working || stepsShown) ? (
                <SettingsSection
                    footer={t("settings.wallet.notificationFooter")}
                    title={t("settings.wallet.notificationSection")}
                >
                    <StepList steps={NOTIFICATION_STEPS} />
                </SettingsSection>
            ) : null}

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
                {working && linked ? (
                    <Button className="rounded-full" fullWidth onPress={getShortcut} size="md" variant="ghost">
                        {t("settings.wallet.getAgain")}
                    </Button>
                ) : null}
            </View>

            {working ? null : (
                <ProofBlock detail={t("settings.wallet.tryIt")} title={t("settings.wallet.nothingYet")} />
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
        <ProofBlock
            detail={parts.join(" · ")}
            title={formatAmount(row.amount, row.currency ?? ledgerCurrency, showCents, language)}
        />
    );
}

function Proof({
    db,
    lastEntry,
    lastRunAt,
}: {
    db: Database;
    lastEntry: LastWalletEntry | null;
    lastRunAt: number | null;
}) {
    const t = useTranslation();
    if (lastEntry) {
        return <LastEntry db={db} txId={lastEntry.txId} />;
    }
    if (lastRunAt != null) {
        return <RanOnly at={lastRunAt} />;
    }
    return <Text className="text-muted text-body pt-6 leading-snug">{t("settings.wallet.lead")}</Text>;
}

function RanOnly({ at }: { at: number }) {
    const t = useTranslation();
    const { language } = useLanguage();
    const { use24Hour } = useDisplaySettings().state;
    const when = `${formatChargeDate(new Date(at), undefined, language)} ${formatTime(new Date(at), use24Hour, language)}`;
    return <ProofBlock detail={t("settings.wallet.ranAt", { when })} title={t("settings.wallet.nothingLogged")} />;
}

function ProofBlock({ title, detail }: { detail: string; title: string }) {
    const t = useTranslation();
    return (
        <View className="gap-1.5 pt-6">
            <MonoLabel>{t("settings.wallet.lastSection")}</MonoLabel>
            <Text className="text-foreground text-title" style={TABULAR}>
                {title}
            </Text>
            <Text className="text-muted text-subtitle" numberOfLines={2}>
                {detail}
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

const FRAME_WIDTH = 150;
const FRAME_HEIGHT = 325;
const FRAME_GAP = 12;
const FRAME_RADIUS = 12;

/** The steps that have a frame, in a swipeable row above the list. */
function FrameStrip({ steps }: { steps: readonly Step[] }) {
    const t = useTranslation();
    const framed = steps.flatMap((step, index) =>
        step.frame ? [{ ...step, frame: step.frame, number: index + 1 }] : []
    );
    if (framed.length === 0) {
        return null;
    }
    return (
        <Carousel align="start" className="-mx-5 pt-3" itemSize={FRAME_WIDTH + FRAME_GAP}>
            <Carousel.Content style={{ height: FRAME_HEIGHT + 44 }}>
                {framed.map((step) => (
                    <Carousel.Item className="gap-1.5 pl-5" key={step.title}>
                        <Image
                            contentFit="cover"
                            source={step.frame}
                            style={{ borderRadius: FRAME_RADIUS, height: FRAME_HEIGHT, width: FRAME_WIDTH }}
                        />
                        <Text className="text-muted text-subtitle" numberOfLines={2} style={{ width: FRAME_WIDTH }}>
                            <Text className="text-foreground font-mono" style={TABULAR}>
                                {String(step.number)}
                            </Text>
                            {`  ${t(step.title)}`}
                        </Text>
                    </Carousel.Item>
                ))}
            </Carousel.Content>
        </Carousel>
    );
}

function StepList({ steps }: { steps: readonly Step[] }) {
    const t = useTranslation();
    return (
        <>
            <FrameStrip steps={steps} />
            {steps.map((step, index) => (
                <StepRow
                    detail={step.detail ? t(step.detail) : undefined}
                    key={step.title}
                    number={index + 1}
                    title={t(step.title)}
                />
            ))}
        </>
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

function ToggleStepsRow({ linked, shown, onPress }: { linked: boolean; onPress: () => void; shown: boolean }) {
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
            <Text className="text-muted text-subtitle">
                {t(linked ? "settings.wallet.automationDetail" : "settings.wallet.automationDetailInline")}
            </Text>
        </Text>
    );
}
