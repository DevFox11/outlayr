import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Linking, Share } from "react-native";
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
import type { Database } from "@/db/client";
import { themeLabel } from "@/theme/theme-preference";

const SUPPORT_EMAIL = "support@tryoutlayr.com";
const WEBSITE = "https://tryoutlayr.com";
const X_PROFILE = "https://x.com/tryoutlayr";

export default function SettingsScreenRoute() {
	const db = useDatabase();
	return <SettingsContent db={db} />;
}

function SettingsContent({ db }: { db: Database }) {
	const router = useRouter();
	const { themePreference } = useAppTheme();

	const currency = useGlobalCurrency(db);
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

	return (
		<SettingsScreen footer={`Outlayr ${version} (${build})`}>
			<SettingsSection title="Logging">
				<LinkRow
					icon="Currency"
					onPress={() => router.push("/settings/currency")}
					title="Currency"
					value={currency}
				/>
				<LinkRow
					icon="Calculator01"
					onPress={() => router.push("/settings/number-entry")}
					title="Number Entry"
					value={numberEntryLabel(numberEntryType)}
				/>
				<LinkRow
					icon="Calendar01"
					onPress={() => router.push("/settings/time")}
					title="Time Frames"
				/>
				<ToggleRow
					icon="MoneyAdd01"
					onValueChange={(next) => {
						setBoolSetting(db, "incomeTracking", next);
					}}
					title="Income Tracking"
					value={incomeTracking}
				/>
			</SettingsSection>

			<SettingsSection title="Appearance">
				<LinkRow
					icon="DarkMode"
					onPress={() => router.push("/settings/theme")}
					title="Theme"
					value={themeLabel(themePreference)}
				/>
				<LinkRow
					icon="SmartPhone01"
					onPress={() => router.push("/settings/app-icon")}
					title="App Icon"
					value="Default"
				/>
				<ToggleRow
					icon="BadgeCent"
					onValueChange={(next) => {
						setBoolSetting(db, "showCents", next);
					}}
					title="Display Cents"
					value={showCents}
				/>
				<ToggleRow
					icon="PlusMinus01"
					onValueChange={(next) => {
						setBoolSetting(db, "showExpenseOrIncomeSign", next);
					}}
					title="Display +/− Symbol"
					value={showSign}
				/>
			</SettingsSection>

			<SettingsSection title="The Log">
				<LinkRow
					icon="Sunrise"
					onPress={() => router.push("/settings/upcoming")}
					title="Upcoming Logs"
					value={shownHiddenLabel(showUpcoming)}
				/>
				<ToggleRow
					icon="ChartLineData01"
					onValueChange={(next) => {
						setBoolSetting(db, "logViewLineGraph", next);
					}}
					title="Log Trend Line"
					value={logTrendLine}
				/>
				<ToggleRow
					icon="Analytics01"
					onValueChange={(next) => {
						setBoolSetting(db, "animatedCharts", next);
					}}
					title="Animated Charts"
					value={animatedCharts}
				/>
			</SettingsSection>

			<SettingsSection title="Your data">
				<LinkRow
					icon="DashboardSquare01"
					onPress={() => router.push("/settings/categories")}
					title="Categories"
				/>
				<LinkRow icon="Cloud" title="Sync" value="Not available" />
				<LinkRow
					icon="FileImport"
					onPress={() => router.push("/settings/import")}
					title="Import Data"
				/>
				<LinkRow
					icon="FileExport"
					onPress={() => router.push("/settings/export")}
					title="Export Data"
				/>
				<LinkRow
					destructive
					icon="Delete02"
					onPress={() => router.push("/settings/erase")}
					title="Erase Data"
				/>
			</SettingsSection>

			<SettingsSection title="This device">
				<LinkRow
					icon="Notification03"
					onPress={() => router.push("/settings/notifications")}
					title="Notifications"
					value={onOffLabel(showNotifications)}
				/>
				<ToggleRow
					icon="BiometricAccess"
					onValueChange={(next) => {
						setBoolSetting(db, "biometricLock", next);
					}}
					title="Authentication"
					value={biometricLock}
				/>
				<LinkRow
					icon="Tap01"
					onPress={() => router.push("/settings/haptics")}
					title="Haptics"
					value={hapticsLabel(haptics)}
				/>
				<LinkRow
					icon="TestTube"
					onPress={() => router.push("/settings/feature-lab")}
					title="Feature Lab"
				/>
			</SettingsSection>

			<SettingsSection title="Outlayr">
				<LinkRow
					icon="Bug01"
					onPress={() => {
						Linking.openURL(mailto(SUPPORT_EMAIL, "Support Email"));
					}}
					title="Report Bug"
				/>
				<LinkRow
					icon="Idea01"
					onPress={() => {
						Linking.openURL(mailto(SUPPORT_EMAIL, "Feature Request"));
					}}
					title="Feature Request"
				/>
				<LinkRow
					icon="Star"
					onPress={() => {
						Linking.openURL(WEBSITE);
					}}
					title="Rate on App Store"
				/>
				<LinkRow
					icon="Share08"
					onPress={() => {
						Share.share({
							message: `Track your money with Outlayr — ${WEBSITE}`,
							url: WEBSITE,
						});
					}}
					title="Share with Friends"
				/>
				<LinkRow
					icon="NewTwitter"
					onPress={() => {
						Linking.openURL(X_PROFILE);
					}}
					title="Follow Outlayr on X"
				/>
				<LinkRow
					icon="InformationCircle"
					onPress={() => router.push("/settings/about")}
					title="About & Credits"
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}

function mailto(address: string, subject: string): string {
	return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}
