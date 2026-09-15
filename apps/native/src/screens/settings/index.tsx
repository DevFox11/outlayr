import Constants from "expo-constants";
import { openSettings } from "expo-linking";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Linking, Platform, Share, useColorScheme } from "react-native";

import { ImportSheet } from "@/components/import-sheet/import-sheet";
import type { ImportSheetHandle } from "@/components/import-sheet/import-sheet";
import { AccountRow } from "@/components/settings/account-row";
import { LinkRow, PickerRow, SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppSettings, useDisplaySettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useRevenueCat } from "@/contexts/revenuecat-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
    choiceDetail,
    HAPTICS_OPTIONS,
    NUMBER_ENTRY_OPTIONS,
    onOffLabel,
    setBoolSetting,
    setNumberSetting,
    shownHiddenLabel,
} from "@/data/settings-core";
import { useSyncStatus } from "@/data/use-sync-status";
import { useValuationCoverage } from "@/data/use-valuation-coverage";
import type { Database } from "@/db/client";
import { ACCENTS } from "@/domain/accent";
import { appIconLabel } from "@/domain/app-icons";
import { lockFailureMessage } from "@/domain/app-lock";
import { syncPaused, syncStatusLabel } from "@/domain/sync-status";
import { coverageNote } from "@/domain/valuation-coverage";
import { useProEntitled } from "@/hooks/use-pro-locked";
import { useLanguage, useTranslation } from "@/i18n/context";
import { languageLabel } from "@/i18n/languages";
import { translateNow } from "@/i18n/runtime";
import { alternateIconsSupported, useAppIcon } from "@/lib/app-icon";
import { requestUnlock } from "@/lib/app-lock";
import { APP_BUILD, APP_VERSION } from "@/lib/app-version";
import { importDraftStore } from "@/lib/import-draft-store";
import { notifyFailure } from "@/lib/notify";
import { useReminderSync } from "@/lib/reminder-sync";
import { supportMailto } from "@/lib/support-mailto";
import type { SupportDiagnostics } from "@/lib/support-mailto";
import { THEME_OPTIONS } from "@/theme/theme-preference";

/**
 * iOS owns the per-app language, so the row is a signpost rather than a control:
 * it reports what the system resolved and hands the choice back to Settings.
 * Doing it here as well would leave two sources of truth, and the SwiftUI date
 * pickers would still follow the system one.
 */
function openLanguageSettings() {
    openSettings().catch(() => {
        // Nothing to recover: the row is informational either way.
    });
}

const SUPPORT_EMAIL = "support@tryoutlayr.com";
const WEBSITE = "https://tryoutlayr.com";
const X_PROFILE = "https://x.com/tryoutlayr";

/**
 * Both directions pass the check first. Arming the lock without one is how a
 * user shuts themselves out behind a Face ID they never enrolled.
 */
async function toggleAppLock(db: Database, next: boolean): Promise<void> {
    const result = await requestUnlock(translateNow(next ? "settings.lock.promptOn" : "settings.lock.promptOff"));
    if (result.success) {
        await setBoolSetting(db, "biometricLock", next);
        return;
    }
    const messageKey = lockFailureMessage(result.error);
    if (messageKey) {
        notifyFailure({
            body: translateNow(messageKey),
            title: translateNow("settings.lock.alertTitle"),
        });
    }
}

export function Settings() {
    const db = useDatabase();
    const router = useRouter();
    const t = useTranslation();
    const { isPro } = useRevenueCat();
    const importSheetRef = useRef<ImportSheetHandle>(null);
    const { language } = useLanguage();
    useReminderSync(db);

    const currency = useGlobalCurrency(db);
    const coverage = useValuationCoverage(db);
    const sync = useSyncStatus(db);
    const proEntitled = useProEntitled();
    const { state: settings } = useAppSettings();
    const { showCents } = useDisplaySettings().state;
    const showNotifications = settings.bool("showNotifications");
    const biometricLock = settings.bool("biometricLock");
    const incomeTracking = settings.bool("incomeTracking");
    const showUpcoming = settings.bool("showUpcoming");
    const animatedCharts = settings.bool("animatedCharts");
    const numberEntryType = settings.number("numberEntryType");
    const haptics = settings.number("haptics");
    const accentColor = settings.number("accentColor");
    const colorScheme = settings.number("colorScheme");
    const scheme = useColorScheme() === "dark" ? "dark" : "light";

    const diagnostics = supportDiagnostics(APP_VERSION, APP_BUILD);

    const numberEntryDetail = choiceDetail(NUMBER_ENTRY_OPTIONS, numberEntryType);

    const syncLabel = syncStatusLabel(sync.pending, sync.syncedAt, syncPaused(sync.enabled, proEntitled));
    const syncValue = syncLabel.count === undefined ? t(syncLabel.key) : t(syncLabel.key, { count: syncLabel.count });

    return (
        <SettingsScreen footer={`Outlayr ${APP_VERSION} (${APP_BUILD})`}>
            <SettingsSection title={t("settings.section.account")}>
                <AccountRow />
                <LinkRow
                    icon="Sparkles"
                    onPress={() => router.push("/paywall")}
                    title={t("pro.entry.title")}
                    value={isPro ? t("pro.entry.valuePro") : t("pro.entry.value")}
                />
                <LinkRow
                    icon="Cloud"
                    onPress={() => router.push("/settings/sync")}
                    title={t("settings.row.sync")}
                    value={syncValue}
                />
            </SettingsSection>

            <SettingsSection footer={coverageNote(coverage, t) ?? undefined} title={t("settings.section.money")}>
                <LinkRow
                    icon="Currency"
                    onPress={() => router.push("/settings/currency")}
                    title={t("settings.row.currency")}
                    value={currency}
                />
                <PickerRow
                    detail={numberEntryDetail ? t(numberEntryDetail) : undefined}
                    icon="Calculator01"
                    onChange={(next) => {
                        setNumberSetting(db, "numberEntryType", next);
                    }}
                    options={NUMBER_ENTRY_OPTIONS.map((option) => ({
                        label: t(option.label),
                        value: option.value,
                    }))}
                    title={t("settings.row.numberEntry")}
                    value={numberEntryType}
                />
                <ToggleRow
                    icon="MoneyAdd01"
                    onValueChange={(next) => {
                        setBoolSetting(db, "incomeTracking", next);
                    }}
                    title={t("settings.row.incomeTracking")}
                    value={incomeTracking}
                />
                <ToggleRow
                    icon="BadgeCent"
                    onValueChange={(next) => {
                        setBoolSetting(db, "showCents", next);
                    }}
                    testID="toggle-display-cents"
                    title={t("settings.row.displayCents")}
                    value={showCents}
                />
            </SettingsSection>

            <SettingsSection title={t("settings.section.appearance")}>
                <PickerRow
                    icon="DarkMode"
                    onChange={(next) => {
                        setNumberSetting(db, "colorScheme", next);
                    }}
                    options={THEME_OPTIONS.map((option) => ({
                        label: t(option.label),
                        value: option.value,
                    }))}
                    title={t("settings.row.colorScheme")}
                    value={colorScheme}
                />
                <PickerRow
                    icon="Swatch"
                    onChange={(next) => {
                        setNumberSetting(db, "accentColor", next);
                    }}
                    options={ACCENTS.map((accent) => ({
                        label: t(accent.label),
                        swatch: accent[scheme],
                        value: accent.value,
                    }))}
                    // The value the app is painting right now, not the light one: the two
                    // halves of an accent differ, and a dot showing the other half would
                    // disagree with every control around it.
                    title={t("settings.row.theme")}
                    value={accentColor}
                />
                {alternateIconsSupported ? <AppIconRow /> : null}
                <LinkRow
                    detail={t("language.footer")}
                    icon="LanguageSkill"
                    onPress={openLanguageSettings}
                    title={t("settings.row.language")}
                    value={languageLabel(language)}
                />
                <ToggleRow
                    icon="Analytics01"
                    onValueChange={(next) => {
                        setBoolSetting(db, "animatedCharts", next);
                    }}
                    title={t("settings.row.animatedCharts")}
                    value={animatedCharts}
                />
            </SettingsSection>

            <SettingsSection title={t("settings.section.ledger")}>
                <LinkRow icon="Bank" onPress={() => router.push("/accounts")} title={t("settings.row.accounts")} />
                <LinkRow
                    icon="DashboardSquare01"
                    onPress={() => router.push("/settings/categories")}
                    title={t("settings.row.categories")}
                />
                <LinkRow
                    icon="Sunrise"
                    onPress={() => router.push("/settings/upcoming")}
                    title={t("settings.row.upcoming")}
                    value={t(shownHiddenLabel(showUpcoming))}
                />
                <LinkRow
                    icon="Calendar01"
                    onPress={() => router.push("/settings/time")}
                    title={t("settings.row.timeFrames")}
                />
            </SettingsSection>

            <SettingsSection title={t("settings.section.device")}>
                {Platform.OS === "ios" ? (
                    <LinkRow
                        icon="Wallet01"
                        onPress={() => router.push("/settings/wallet")}
                        title={t("settings.row.wallet")}
                    />
                ) : null}
                <LinkRow
                    icon="Notification03"
                    onPress={() => router.push("/settings/notifications")}
                    title={t("settings.row.notifications")}
                    value={t(onOffLabel(showNotifications))}
                />
                <ToggleRow
                    icon="BiometricAccess"
                    onValueChange={async (next) => {
                        await toggleAppLock(db, next);
                    }}
                    title={t("settings.row.authentication")}
                    value={biometricLock}
                />
                <PickerRow
                    icon="Tap01"
                    onChange={(next) => {
                        setNumberSetting(db, "haptics", next);
                    }}
                    options={HAPTICS_OPTIONS.map((option) => ({
                        label: t(option.label),
                        value: option.value,
                    }))}
                    title={t("settings.row.haptics")}
                    value={haptics}
                />
            </SettingsSection>

            <SettingsSection title={t("settings.section.data")}>
                <LinkRow
                    icon="FileImport"
                    onPress={() => {
                        importDraftStore.setStep(importDraftStore.getResumeStep());
                        importSheetRef.current?.present();
                    }}
                    title={t("settings.row.import")}
                />
                <LinkRow
                    icon="FileExport"
                    onPress={() => router.push("/settings/export")}
                    title={t("settings.row.export")}
                />
                <LinkRow
                    icon="ArchiveRestore"
                    onPress={() => router.push("/settings/restore")}
                    title={t("settings.row.restore")}
                />
                <LinkRow
                    icon="Delete02"
                    onPress={() => router.push("/settings/deleted")}
                    title={t("settings.row.deleted")}
                />
                <LinkRow
                    destructive
                    icon="Delete02"
                    onPress={() => router.push("/settings/erase")}
                    title={t("settings.row.erase")}
                />
            </SettingsSection>

            <SettingsSection title={t("settings.section.about")}>
                <LinkRow
                    icon="TestTube"
                    onPress={() => router.push("/settings/feature-lab")}
                    title={t("settings.row.featureLab")}
                />
                <LinkRow
                    icon="Bug01"
                    onPress={() => {
                        Linking.openURL(supportMailto(SUPPORT_EMAIL, t("settings.support.bugSubject"), diagnostics));
                    }}
                    title={t("settings.row.reportBug")}
                />
                <LinkRow
                    icon="Idea01"
                    onPress={() => {
                        Linking.openURL(
                            supportMailto(SUPPORT_EMAIL, t("settings.support.featureSubject"), diagnostics)
                        );
                    }}
                    title={t("settings.row.featureRequest")}
                />
                <LinkRow
                    icon="Star"
                    onPress={() => {
                        Linking.openURL(WEBSITE);
                    }}
                    title={t("settings.row.rate")}
                />
                <LinkRow
                    icon="Share08"
                    onPress={() => {
                        Share.share({
                            message: t("settings.share.message", { url: WEBSITE }),
                            url: WEBSITE,
                        });
                    }}
                    title={t("settings.row.share")}
                />
                <LinkRow
                    icon="NewTwitter"
                    onPress={() => {
                        Linking.openURL(X_PROFILE);
                    }}
                    title={t("settings.row.followX")}
                />
                <LinkRow
                    icon="InformationCircle"
                    onPress={() => router.push("/settings/about")}
                    title={t("settings.row.about")}
                />
            </SettingsSection>
            <ImportSheet ref={importSheetRef} />
        </SettingsScreen>
    );
}

/**
 * Its own component so that reading the icon back from iOS — and the focus
 * effect that keeps it current — happens only where the row exists at all.
 */
function AppIconRow() {
    const router = useRouter();
    const t = useTranslation();
    const { active } = useAppIcon();
    return (
        <LinkRow
            icon="SmartPhone01"
            onPress={() => router.push("/settings/app-icon")}
            title={t("settings.row.appIcon")}
            value={t(appIconLabel(active))}
        />
    );
}

/**
 * `expo-device` is not installed and adding it would force a dev-client rebuild,
 * so the model comes from `Constants.deviceName` (`UIDevice.name`). Since iOS 16
 * that reads back as the model — "iPhone" — unless the app holds the
 * user-assigned-device-name entitlement, which is coarser than Swift's
 * `modelName` but still narrows a report to a platform and OS release.
 */
function supportDiagnostics(version: string, build: string): SupportDiagnostics {
    return {
        appBuild: build,
        appName: Constants.expoConfig?.name ?? "Outlayr",
        appVersion: version,
        deviceName: Constants.deviceName ?? "",
        osName: Platform.select({ android: "Android", ios: "iOS" }) ?? Platform.OS,
        osVersion: String(Platform.Version),
    };
}
