import { useEffect } from "react";
import { AppState } from "react-native";
import { readBoolSetting, readNumberSetting, setBoolSetting } from "@/data/settings";
import type { Database } from "@/db/client";
import { clampTimeOfDay, reminderReconcile, reminderTime, type TimeOfDay } from "@/domain/reminder";
import { cancelReminder, reminderPermission, scheduleReminder } from "./reminders";

export async function readReminderTime(db: Database): Promise<TimeOfDay> {
	const [option, hour, minute] = await Promise.all([
		readNumberSetting(db, "notificationOption"),
		readNumberSetting(db, "notificationHour"),
		readNumberSetting(db, "notificationMinute"),
	]);
	return reminderTime(option, clampTimeOfDay(hour, minute));
}

export async function armReminder(db: Database): Promise<void> {
	await scheduleReminder(await readReminderTime(db));
}

async function syncReminder(db: Database): Promise<void> {
	const [enabled, permission] = await Promise.all([readBoolSetting(db, "showNotifications"), reminderPermission()]);
	switch (reminderReconcile(enabled, permission)) {
		case "schedule":
			await armReminder(db);
			return;
		case "disable":
			await cancelReminder();
			await setBoolSetting(db, "showNotifications", false);
			return;
		default:
			return;
	}
}

/**
 * Notification permission lives in iOS Settings, where it can be revoked while
 * the app is suspended. Without this the Settings row would keep reading "On"
 * against a reminder iOS has stopped delivering.
 */
export function useReminderSync(db: Database): void {
	useEffect(() => {
		const reconcile = () => {
			syncReminder(db).catch((error) => {
				console.error("Reminder sync failed", error);
			});
		};

		reconcile();

		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				reconcile();
			}
		});

		return () => {
			subscription.remove();
		};
	}, [db]);
}
