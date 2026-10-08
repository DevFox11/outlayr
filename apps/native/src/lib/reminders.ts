import {
    cancelScheduledNotificationAsync,
    getAllScheduledNotificationsAsync,
    getPermissionsAsync,
    requestPermissionsAsync,
    SchedulableTriggerInputTypes,
    scheduleNotificationAsync,
} from "expo-notifications";
import type { NotificationPermissionsStatus } from "expo-notifications";
import { Linking } from "react-native";

import type { ReminderPermission, TimeOfDay } from "@/domain/reminder";
import { translateNow } from "@/i18n/runtime";

/**
 * Fixed so a reschedule replaces the pending request instead of stacking a
 * second one. Swift cleared the whole queue each time (`newNotification()`),
 * which would also take out anything else the app ever schedules.
 */
const REMINDER_ID = "outlayr.daily-reminder";

/** On iOS `canAskAgain` is true only while the prompt has never been shown. */
function toPermission(result: NotificationPermissionsStatus): ReminderPermission {
    if (result.granted) {
        return "granted";
    }
    return result.canAskAgain ? "undetermined" : "denied";
}

export async function reminderPermission(): Promise<ReminderPermission> {
    try {
        return toPermission(await getPermissionsAsync());
    } catch (error) {
        console.warn("[outlayr] notification permission read failed", error);
        return "unknown";
    }
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
    try {
        return toPermission(
            await requestPermissionsAsync({
                ios: { allowAlert: true, allowBadge: true, allowSound: true },
            })
        );
    } catch (error) {
        console.warn("[outlayr] notification permission request failed", error);
        return "unknown";
    }
}

export async function scheduleReminder({ hour, minute }: TimeOfDay): Promise<void> {
    await scheduleNotificationAsync({
        content: {
            body: translateNow("reminder.body"),
            sound: "default",
            title: translateNow("reminder.title"),
        },
        identifier: REMINDER_ID,
        trigger: { hour, minute, type: SchedulableTriggerInputTypes.DAILY },
    });
}

export async function cancelReminder(): Promise<void> {
    await cancelScheduledNotificationAsync(REMINDER_ID);
}

/** Identifiers iOS currently holds, the daily reminder's among them. */
export async function pendingReminderIds(): Promise<string[]> {
    try {
        const requests = await getAllScheduledNotificationsAsync();
        return requests.map((request) => request.identifier);
    } catch {
        return [];
    }
}

export interface DatedReminder {
    body: string;
    data: Record<string, string>;
    fireAt: Date;
    id: string;
    title: string;
}

/**
 * A one-shot DATE trigger rather than a repeat: the next charge in a chain lands
 * on a date the schedule has to recompute, so each sweep arms the next one
 * afresh under the same identifier.
 */
export async function scheduleDatedReminder({ id, title, body, data, fireAt }: DatedReminder): Promise<void> {
    await scheduleNotificationAsync({
        content: { body, data, sound: "default", title },
        identifier: id,
        trigger: { date: fireAt, type: SchedulableTriggerInputTypes.DATE },
    });
}

/** Sequential: `cancelScheduledNotificationAsync` mutates one shared iOS queue. */
export async function cancelReminders(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
        // oxlint-disable-next-line no-await-in-loop -- cancelScheduledNotificationAsync mutates one shared iOS notification queue, so overlapping cancels race each other.
        await cancelScheduledNotificationAsync(id);
    }
}

export function openNotificationSettings(): void {
    Linking.openSettings().catch((error) => {
        console.warn("[outlayr] opening notification settings failed", error);
    });
}
