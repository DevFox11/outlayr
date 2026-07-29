import {
	cancelScheduledNotificationAsync,
	getPermissionsAsync,
	type NotificationPermissionsStatus,
	requestPermissionsAsync,
	SchedulableTriggerInputTypes,
	scheduleNotificationAsync,
} from "expo-notifications";
import { Linking } from "react-native";
import type { ReminderPermission, TimeOfDay } from "@/domain/reminder";

/**
 * Fixed so a reschedule replaces the pending request instead of stacking a
 * second one. Swift cleared the whole queue each time (`newNotification()`),
 * which would also take out anything else the app ever schedules.
 */
const REMINDER_ID = "outlayr.daily-reminder";

/** On iOS `canAskAgain` is true only while the prompt has never been shown. */
function toPermission(
	result: NotificationPermissionsStatus,
): ReminderPermission {
	if (result.granted) {
		return "granted";
	}
	return result.canAskAgain ? "undetermined" : "denied";
}

export async function reminderPermission(): Promise<ReminderPermission> {
	try {
		return toPermission(await getPermissionsAsync());
	} catch {
		return "denied";
	}
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
	try {
		return toPermission(
			await requestPermissionsAsync({
				ios: { allowAlert: true, allowBadge: true, allowSound: true },
			}),
		);
	} catch {
		return "denied";
	}
}

export async function scheduleReminder({
	hour,
	minute,
}: TimeOfDay): Promise<void> {
	await scheduleNotificationAsync({
		identifier: REMINDER_ID,
		content: {
			title: "Keep the streak going",
			body: "Log what you spent today.",
			sound: "default",
		},
		trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute },
	});
}

export async function cancelReminder(): Promise<void> {
	await cancelScheduledNotificationAsync(REMINDER_ID);
}

export function openNotificationSettings(): void {
	void Linking.openSettings();
}
