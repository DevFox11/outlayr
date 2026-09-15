import { readBoolSetting, readNumberSetting, setBoolSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { clampTimeOfDay, reminderReconcile, reminderTime } from "@/domain/reminder";
import type { TimeOfDay } from "@/domain/reminder";
import { useForegroundSweep } from "@/lib/use-foreground-sweep";

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
        case "schedule": {
            await armReminder(db);
            return;
        }
        case "disable": {
            await cancelReminder();
            await setBoolSetting(db, "showNotifications", false);
            break;
        }
        default: {
            break;
        }
    }
}

/**
 * Notification permission lives in iOS Settings, where it can be revoked while
 * the app is suspended. Without this the Settings row would keep reading "On"
 * against a reminder iOS has stopped delivering.
 */
export function useReminderSync(db: Database): void {
    useForegroundSweep(db, syncReminder, "Reminder sync");
}
