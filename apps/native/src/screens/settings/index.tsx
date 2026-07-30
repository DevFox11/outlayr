import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Alert, Linking, Platform, Share } from "react-native";
import { AccountRow } from "@/components/settings/account-row";
import {
	LinkRow,
	SettingsSection,
	ToggleRow,
} from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { useAppTheme } from "@/contexts/app-theme-context";
import { useDatabase } from "@/contexts/local-data-context";
import { useGlobalCurrency } from "@/data/app-meta";
import {
	hapticsLabel,
	numberEntryLabel,
	onOffLabel,
	setBoolSetting,
	shownHiddenLabel,
	useBoolSetting,
	useNumberSetting,
} from "@/data/settings";
import { useSyncStatus } from "@/data/use-sync-status";
import { useValuationCoverage } from "@/data/use-valuation-coverage";
import type { Database } from "@/db/client";
import { appIconLabel } from "@/domain/app-icons";
import { lockFailureMessage } from "@/domain/app-lock";
import { syncStatusLabel } from "@/domain/sync-status";
import { coverageNote } from "@/domain/valuation-coverage";
import {
	languageLabel,
	translateNow,
	useLanguage,
	useTranslation,
} from "@/i18n";
import { alternateIconsSupported, useAppIcon } from "@/lib/app-icon";
import { requestUnlock } from "@/lib/app-lock";
import { useReminderSync } from "@/lib/reminder-sync";
import { type SupportDiagnostics, supportMailto } from "@/lib/support-mailto";
import { themeLabel } from "@/theme/theme-preference";

const SUPPORT_EMAIL = "support@tryoutlayr.com";
const WEBSITE = "https://tryoutlayr.com";
const X_PROFILE = "https://x.com/tryoutlayr";

/**
 * Both directions pass the check first. Arming the lock without one is how a
 * user shuts themselves out behind a Face ID they never enrolled.
 */
async function toggleAppLock(db: Database, next: boolean): Promise<void> {
	const result = await requestUnlock(
		translateNow(next ? "settings.lock.promptOn" : "settings.lock.promptOff"),
	);
	if (result.success) {
		await setBoolSetting(db, "biometricLock", next);
		return;
	}
	const messageKey = lockFailureMessage(result.error);
	if (messageKey) {
		Alert.alert(
			translateNow("settings.lock.alertTitle"),
			translateNow(messageKey),
		);
	}
}

export default function SettingsScreenRoute() {
	const db = useDatabase();
	return <SettingsContent db={db} />;
}

function SettingsContent({ db }: { db: Database }) {
	const router = useRouter();
	const t = useTranslation();
	const { themePreference } = useAppTheme();
	const { preference } = useLanguage();
	useReminderSync(db);

	const currency = useGlobalCurrency(db);
	const coverage = useValuationCoverage(db);
	const sync = useSyncStatus(db);
	const showNotifications = useBoolSetting(db, "showNotifications");
	const biometricLock = useBoolSetting(db, "biometricLock");
	const incomeTracking = useBoolSetting(db, "incomeTracking");
	const showCents = useBoolSetting(db, "showCents");
	const showUpcoming = useBoolSetting(db, "showUpcoming");
	const showSign = useBoolSetting(db, "showExpenseOrIncomeSign");
	const animatedCharts = useBoolSetting(db, "animatedCharts");
	const logTrendLine = useBoolSetting(db, "logViewLineGraph");
	const numberEntryType = useNumberSetting(db, "numberEntryType");
	const haptics = useNumberSetting(db, "haptics");

	const version = Constants.expoConfig?.version ?? "1.0.0";
	const build = Constants.expoConfig?.ios?.buildNumber ?? "1";
	const diagnostics = supportDiagnostics(version, build);

	const hapticsValue = hapticsLabel(haptics);

	const syncLabel = syncStatusLabel(sync.pending, sync.syncedAt);
	const syncValue =
		syncLabel.count === undefined
			? t(syncLabel.key)
			: t(syncLabel.key, { count: String(syncLabel.count) });

	return (
		<SettingsScreen footer={`Outlayr ${version} (${build})`}>
			<SettingsSection
				title={t("settings.section.logging")}
				footer={coverageNote(coverage, t) ?? undefined}
			>
				<LinkRow
					icon="Currency"
					onPress={() => router.push("/settings/currency")}
					title={t("settings.row.currency")}
					value={currency}
				/>
				<LinkRow
					icon="Calculator01"
					onPress={() => router.push("/settings/number-entry")}
					title={t("settings.row.numberEntry")}
					value={t(numberEntryLabel(numberEntryType))}
				/>
				<LinkRow
					icon="Calendar01"
					onPress={() => router.push("/settings/time")}
					title={t("settings.row.timeFrames")}
				/>
				<ToggleRow
					icon="MoneyAdd01"
					onValueChange={(next) => {
						setBoolSetting(db, "incomeTracking", next);
					}}
					title={t("settings.row.incomeTracking")}
					value={incomeTracking}
				/>
			</SettingsSection>

			<SettingsSection title={t("settings.section.appearance")}>
				<LinkRow
					icon="DarkMode"
					onPress={() => router.push("/settings/theme")}
					title={t("settings.row.theme")}
					value={t(themeLabel(themePreference))}
				/>
				{alternateIconsSupported ? <AppIconRow /> : null}
				<LinkRow
					icon="LanguageSkill"
					onPress={() => router.push("/settings/language")}
					title={t("nav.settings.language")}
					value={
						preference === "system"
							? t("language.system")
							: languageLabel(preference)
					}
				/>
				<ToggleRow
					icon="BadgeCent"
					onValueChange={(next) => {
						setBoolSetting(db, "showCents", next);
					}}
					title={t("settings.row.displayCents")}
					value={showCents}
				/>
				<ToggleRow
					icon="PlusMinus01"
					onValueChange={(next) => {
						setBoolSetting(db, "showExpenseOrIncomeSign", next);
					}}
					title={t("settings.row.displaySign")}
					value={showSign}
				/>
			</SettingsSection>

			<SettingsSection title={t("settings.section.log")}>
				<LinkRow
					icon="Sunrise"
					onPress={() => router.push("/settings/upcoming")}
					title={t("settings.row.upcoming")}
					value={t(shownHiddenLabel(showUpcoming))}
				/>
				<ToggleRow
					icon="ChartLineData01"
					onValueChange={(next) => {
						setBoolSetting(db, "logViewLineGraph", next);
					}}
					title={t("settings.row.logTrendLine")}
					value={logTrendLine}
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

			<SettingsSection title={t("settings.section.data")}>
				<AccountRow />
				<LinkRow
					icon="DashboardSquare01"
					onPress={() => router.push("/settings/categories")}
					title={t("settings.row.categories")}
				/>
				<LinkRow
					icon="Cloud"
					title={t("settings.row.sync")}
					value={syncValue}
				/>
				<LinkRow
					icon="FileImport"
					onPress={() => router.push("/settings/import")}
					title={t("settings.row.import")}
				/>
				<LinkRow
					icon="FileExport"
					onPress={() => router.push("/settings/export")}
					title={t("settings.row.export")}
				/>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() => router.push("/settings/erase")}
					title={t("settings.row.erase")}
				/>
			</SettingsSection>

			<SettingsSection title={t("settings.section.device")}>
				<LinkRow
					icon="Notification03"
					onPress={() => router.push("/settings/notifications")}
					title={t("settings.row.notifications")}
					value={t(onOffLabel(showNotifications))}
				/>
				<ToggleRow
					icon="BiometricAccess"
					onValueChange={(next) => {
						void toggleAppLock(db, next);
					}}
					title={t("settings.row.authentication")}
					value={biometricLock}
				/>
				<LinkRow
					icon="Tap01"
					onPress={() => router.push("/settings/haptics")}
					title={t("settings.row.haptics")}
					value={hapticsValue == null ? undefined : t(hapticsValue)}
				/>
				<LinkRow
					icon="TestTube"
					onPress={() => router.push("/settings/feature-lab")}
					title={t("settings.row.featureLab")}
				/>
			</SettingsSection>

			<SettingsSection title="Outlayr">
				<LinkRow
					icon="Bug01"
					onPress={() => {
						Linking.openURL(
							supportMailto(
								SUPPORT_EMAIL,
								t("settings.support.bugSubject"),
								diagnostics,
							),
						);
					}}
					title={t("settings.row.reportBug")}
				/>
				<LinkRow
					icon="Idea01"
					onPress={() => {
						Linking.openURL(
							supportMailto(
								SUPPORT_EMAIL,
								t("settings.support.featureSubject"),
								diagnostics,
							),
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
function supportDiagnostics(
	version: string,
	build: string,
): SupportDiagnostics {
	return {
		appName: Constants.expoConfig?.name ?? "Outlayr",
		osName: Platform.select({ ios: "iOS", android: "Android" }) ?? Platform.OS,
		osVersion: String(Platform.Version),
		deviceName: Constants.deviceName ?? "",
		appVersion: version,
		appBuild: build,
	};
}
