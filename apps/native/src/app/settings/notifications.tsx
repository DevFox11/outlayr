import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useMemo } from "react";
import { Alert, View } from "react-native";
import {
	ChoiceRow,
	SettingsSection,
	ToggleRow,
} from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import {
	setBoolSetting,
	setNumberSetting,
	useAllSettings,
} from "@/data/settings";
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
import { armReminder, useReminderSync } from "@/lib/reminder-sync";
import {
	cancelReminder,
	openNotificationSettings,
	reminderPermission,
	requestReminderPermission,
} from "@/lib/reminders";
import { useColors } from "@/theme/use-colors";

const OPTIONS = [
	{
		value: REMINDER_MORNING,
		label: "Every morning",
		detail: "A nudge at 8:00 AM, before the day has spent anything.",
	},
	{
		value: REMINDER_EVENING,
		label: "Every evening",
		detail: "A nudge at 8:00 PM, once the day is mostly done.",
	},
	{ value: REMINDER_CUSTOM, label: "Custom time" },
] as const;

function reportReminderFailure(error: unknown): void {
	console.error("Reminder update failed", error);
}

async function enableReminders(db: Database): Promise<void> {
	const existing = await reminderPermission();
	if (enableReminderStep(existing) === "open-settings") {
		Alert.alert(
			"Notifications are off",
			"Outlayr cannot ask again once you have declined. Turn notifications on for Outlayr in iOS Settings and this switch will follow.",
			[
				{ style: "cancel", text: "Not now" },
				{ onPress: openNotificationSettings, text: "Open Settings" },
			],
		);
		return;
	}

	const granted =
		existing === "granted" ? existing : await requestReminderPermission();
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

export default function NotificationsScreen() {
	const db = useDatabase();
	return <Notifications db={db} />;
}

function Notifications({ db }: { db: Database }) {
	useReminderSync(db);

	const colors = useColors();
	const settings = useAllSettings(db);
	const enabled = settings.bool("showNotifications");
	const option = settings.number("notificationOption");
	const custom = clampTimeOfDay(
		settings.number("notificationHour"),
		settings.number("notificationMinute"),
	);
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
		Promise.all([
			setNumberSetting(db, "notificationHour", hour),
			setNumberSetting(db, "notificationMinute", minute),
		])
			.then(() => armReminder(db))
			.catch(reportReminderFailure);
	};

	return (
		<SettingsScreen>
			<SettingsSection
				footer="One reminder a day, from this device. Outlayr never sends anything from a server."
				title="Daily reminder"
			>
				<ToggleRow
					icon="Notification03"
					onValueChange={(next) => {
						(next ? enableReminders(db) : disableReminders(db)).catch(
							reportReminderFailure,
						);
					}}
					title="Remind Me to Log"
					value={enabled}
				/>
			</SettingsSection>

			{enabled ? (
				<SettingsSection
					footer={`Next reminder at ${formatTimeOfDay(scheduled)}.`}
					title="When"
				>
					{OPTIONS.map((choice) => (
						<ChoiceRow
							detail={"detail" in choice ? choice.detail : undefined}
							key={choice.value}
							label={choice.label}
							onPress={() => chooseOption(choice.value)}
							selected={option === choice.value}
						/>
					))}
					{option === REMINDER_CUSTOM ? (
						<View className="flex-row items-center justify-between border-border border-b py-2">
							<Text className="text-body text-foreground">Time</Text>
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
		</SettingsScreen>
	);
}
