import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect } from "react";

import { readBoolSetting, readNumberSetting, setBoolSetting } from "@/data/settings-core";
import { lastLoggedEntry } from "@/data/transactions-core";
import type { Database } from "@/db/client";
import {
    clampTimeOfDay,
    DAILY_REMINDER_PREFIX,
    dailyReminderNotices,
    reminderReconcile,
    reminderTime,
} from "@/domain/reminder";
import type { TimeOfDay } from "@/domain/reminder";
import { useForegroundSweep } from "@/lib/use-foreground-sweep";

import { cancelReminders, pendingReminderIds, reminderPermission, scheduleDatedReminder } from "./reminders";
import { debounce, PUBLISH_DEBOUNCE_MS } from "./sync-cadence";

const RESYNC_TABLES = new Set(["transactions", "appMeta"]);

export async function readReminderTime(db: Database): Promise<TimeOfDay> {
    const [option, hour, minute] = await Promise.all([
        readNumberSetting(db, "notificationOption"),
        readNumberSetting(db, "notificationHour"),
        readNumberSetting(db, "notificationMinute"),
    ]);
    return reminderTime(option, clampTimeOfDay(hour, minute));
}

let queue: Promise<unknown> = Promise.resolve();

export function syncDailyReminder(db: Database): Promise<void> {
    const run = queue.then(() => reconcileDailyReminder(db));
    queue = run.catch(() => null);
    return run;
}

async function reconcileDailyReminder(db: Database): Promise<void> {
    const [enabled, permission, hideAmounts] = await Promise.all([
        readBoolSetting(db, "showNotifications"),
        reminderPermission(),
        readBoolSetting(db, "hideAmounts"),
    ]);
    if (enabled && permission === "unknown") {
        return;
    }
    const decision = reminderReconcile(enabled, permission);
    const now = new Date();
    const notices =
        decision === "schedule"
            ? dailyReminderNotices({
                  hideAmounts,
                  last: await lastLoggedEntry(db, now),
                  now,
                  time: await readReminderTime(db),
              })
            : [];

    const keep = new Set(notices.map((notice) => notice.id));
    const pending = await pendingReminderIds();
    await cancelReminders(pending.filter((id) => id.startsWith(DAILY_REMINDER_PREFIX) && !keep.has(id)));
    for (const notice of notices) {
        // oxlint-disable-next-line no-await-in-loop -- arming mutates the one shared iOS notification queue, which is why `cancelReminders` (lib/reminders.ts) walks it serially too
        await scheduleDatedReminder(notice);
    }

    if (decision === "disable") {
        await setBoolSetting(db, "showNotifications", false);
    }
}

export function useDailyReminderSync(db: Database): void {
    useForegroundSweep(db, syncDailyReminder, "Daily reminder sync");

    useEffect(() => {
        const resync = debounce(PUBLISH_DEBOUNCE_MS, () => {
            syncDailyReminder(db).catch((error) => {
                console.error("Daily reminder sync failed", error);
            });
        });
        const listener = addDatabaseChangeListener((event) => {
            if (RESYNC_TABLES.has(event.tableName)) {
                resync.schedule();
            }
        });
        return () => {
            resync.cancel();
            listener.remove();
        };
    }, [db]);
}
