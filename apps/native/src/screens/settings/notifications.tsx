import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useMemo } from "react";
import { Alert, View } from "react-native";
import { ChoiceRow, SettingsSection, ToggleRow } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useAppSettings } from "@/contexts/display-settings-context";
import { useDatabase } from "@/contexts/local-data-context";
import { setBoolSetting, setNumberSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import {
	clampTimeOfDay,
	enableReminderStep,
	formatTimeOfDay,
	REMINDER_CUSTOM,
	REMINDER_EVENING,
	REMINDER_MORNING,
	reminderTime,
	type TimeOfDay,
} from "@/domain/reminder";
import { type TranslationKey, translateNow, useTranslation } from "@/i18n";
import { armReminder, useReminderSync } from "@/lib/reminder-sync";
import {
	cancelReminder,
	openNotificationSettings,
	reminderPermission,
	requestReminderPermission,
} from "@/lib/reminders";
import { syncSubscriptionReminders } from "@/lib/subscription-reminder-sync";
import { useColors } from "@/theme/use-colors";

const OPTIONS = [
	{
		detail: "settings.notifications.morningDetail",
		label: "settings.notifications.morning",
		value: REMINDER_MORNING,
	},
	{
		detail: "settings.notifications.eveningDetail",
		label: "settings.notifications.evening",
		value: REMINDER_EVENING,
	},
	{ label: "settings.notifications.custom", value: REMINDER_CUSTOM },
] as const satisfies readonly {
	value: number;
	label: TranslationKey;
	detail?: TranslationKey;
}[];

function reportReminderFailure(error: unknown): void {
	console.error("Reminder update failed", error);
}

async function enableReminders(db: Database): Promise<void> {
	const existing = await reminderPermission();
	if (enableReminderStep(existing) === "open-settings") {
		Alert.alert(translateNow("settings.notifications.deniedTitle"), translateNow("settings.notifications.deniedBody"), [
			{
				style: "cancel",
				text: translateNow("settings.notifications.notNow"),
			},
			{
				onPress: openNotificationSettings,
				text: translateNow("settings.notifications.openSettings"),
			},
		]);
		return;
	}

	const granted = existing === "granted" ? existing : await requestReminderPermission();
	if (granted !== "granted") {
		return;
	}

	await setBoolSetting(db, "showNotifications", true);
	await armReminder(db);
}

async function disableReminders(db: Database): Promise<void> {
	await cancelReminder();
	await setBoolSetting(db, "showNotifications", false);
}

/**
 * The same permission ladder, its own key: the daily reminder and the due-date
 * notices are separate promises, and the revoke reconcile writes each back off
 * on its own.
 */
async function setSubscriptionReminders(db: Database, next: boolean): Promise<void> {
	if (next) {
		const existing = await reminderPermission();
		if (enableReminderStep(existing) === "open-settings") {
			Alert.alert(
				translateNow("settings.notifications.deniedTitle"),
				translateNow("settings.notifications.deniedBody"),
				[
					{
						style: "cancel",
						text: translateNow("settings.notifications.notNow"),
					},
					{
						onPress: openNotificationSettings,
						text: translateNow("settings.notifications.openSettings"),
					},
				]
			);
			return;
		}
		const granted = existing === "granted" ? existing : await requestReminderPermission();
		if (granted !== "granted") {
			return;
		}
	}
	await setBoolSetting(db, "subscriptionReminders", next);
	await syncSubscriptionReminders(db);
}

export function Notifications() {
	const db = useDatabase();
	return <NotificationsContent db={db} />;
}

function NotificationsContent({ db }: { db: Database }) {
	useReminderSync(db);

	const colors = useColors();
	const t = useTranslation();
	const { state: settings } = useAppSettings();
	const enabled = settings.bool("showNotifications");
	const subscriptionsEnabled = settings.bool("subscriptionReminders");
	const option = settings.number("notificationOption");
	const custom = clampTimeOfDay(settings.number("notificationHour"), settings.number("notificationMinute"));
	const scheduled = reminderTime(option, custom);

	const pickerValue = useMemo(() => {
		const date = new Date();
		date.setHours(custom.hour, custom.minute, 0, 0);
		return date;
	}, [custom.hour, custom.minute]);

	const chooseOption = (next: number) => {
		setNumberSetting(db, "notificationOption", next)
			.then(() => armReminder(db))
			.catch(reportReminderFailure);
	};

	const chooseTime = ({ hour, minute }: TimeOfDay) => {
		Promise.all([setNumberSetting(db, "notificationHour", hour), setNumberSetting(db, "notificationMinute", minute)])
			.then(() => armReminder(db))
			.catch(reportReminderFailure);
	};

	return (
		<SettingsScreen>
			<SettingsSection footer={t("settings.notifications.footer")} title={t("settings.notifications.section")}>
				<ToggleRow
					icon="Notification03"
					onValueChange={(next) => {
						(next ? enableReminders(db) : disableReminders(db)).catch(reportReminderFailure);
					}}
					title={t("settings.notifications.toggle")}
					value={enabled}
				/>
			</SettingsSection>

			{enabled ? (
				<SettingsSection
					footer={t("settings.notifications.nextAt", {
						time: formatTimeOfDay(scheduled),
					})}
					title={t("settings.notifications.whenSection")}
				>
					{OPTIONS.map((choice) => (
						<ChoiceRow
							detail={"detail" in choice ? t(choice.detail) : undefined}
							key={choice.value}
							label={t(choice.label)}
							onPress={() => chooseOption(choice.value)}
							selected={option === choice.value}
						/>
					))}
					{option === REMINDER_CUSTOM ? (
						<View className="flex-row items-center justify-between border-border border-b py-2">
							<Text className="text-body text-foreground">{t("settings.notifications.time")}</Text>
							<DateTimePicker
								accentColor={colors.tint}
								display="compact"
								mode="time"
								onValueChange={(_event, date) => {
									chooseTime({
										hour: date.getHours(),
										minute: date.getMinutes(),
									});
								}}
								value={pickerValue}
							/>
						</View>
					) : null}
				</SettingsSection>
			) : null}

			<SettingsSection
				footer={t("settings.notifications.subscriptionFooter")}
				title={t("settings.notifications.subscriptionSection")}
			>
				<ToggleRow
					icon="CalendarClock"
					onValueChange={(next) => {
						setSubscriptionReminders(db, next).catch(reportReminderFailure);
					}}
					title={t("settings.notifications.subscriptionToggle")}
					value={subscriptionsEnabled}
				/>
			</SettingsSection>
		</SettingsScreen>
	);
}
