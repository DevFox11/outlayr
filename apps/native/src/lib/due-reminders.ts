import { Alert } from "react-native";

import { getMetaSync } from "@/data/app-meta-core";
import { setBoolSetting } from "@/data/settings-core";
import type { Database } from "@/db/client";
import { enableReminderStep } from "@/domain/reminder";
import { translateNow } from "@/i18n/runtime";

import { openNotificationSettings, reminderPermission, requestReminderPermission } from "./reminders";

/**
 * About an iOS sheet's dismissal, counted from the form's `onDone`: the order
 * is saved from the entry sheet, and the question belongs on the screen behind
 * it, not over a sheet on its way out.
 * shortcut: no event reaches JS when a native sheet finishes dismissing, so this
 * is timed; listen for one if react-native-screens ever reports it.
 */
const AFTER_SHEET_MS = 600;

/**
 * The notification settings' permission ladder, with its own key per kind of
 * due-date notice: the daily reminder and each kind are separate promises, and
 * the revoke reconcile writes each back off on its own. The write re-arms both kinds through `BackgroundWork`'s
 * settings listener, so turning one on arms it within a beat. Resolves false
 * when turning on ended without a grant, so nothing was written.
 */
export async function setDueReminders(
    db: Database,
    key: "installmentReminders" | "subscriptionReminders",
    next: boolean
): Promise<boolean> {
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
            return false;
        }
        const granted = existing === "granted" ? existing : await requestReminderPermission();
        if (granted !== "granted") {
            return false;
        }
    }
    await setBoolSetting(db, key, next);
    return true;
}

/**
 * Asked by every order saved while cuota notices were never set either way,
 * until one answer is given: "Not now" writes them off, and "Turn on" runs the
 * toggle's ladder, which writes them on once iOS grants it and off when it
 * doesn't. An ask that is never answered (the app killed under it) leaves
 * nothing, so the next order asks again. Settings is the way back from either
 * answer. Returns whether it asks, so other prompts can stand aside.
 */
export function askForInstallmentReminders(db: Database): boolean {
    if (getMetaSync(db, "installmentReminders") !== null) {
        return false;
    }
    setTimeout(() => ask(db), AFTER_SHEET_MS);
    return true;
}

async function turnOn(db: Database): Promise<void> {
    if (!(await setDueReminders(db, "installmentReminders", true))) {
        await setBoolSetting(db, "installmentReminders", false);
    }
}

function ask(db: Database): void {
    Alert.alert(translateNow("installments.reminder.ask"), undefined, [
        {
            onPress: () => {
                setBoolSetting(db, "installmentReminders", false).catch((error) => {
                    console.error("Declining installment reminders failed", error);
                });
            },
            style: "cancel",
            text: translateNow("settings.notifications.notNow"),
        },
        {
            onPress: () => {
                turnOn(db).catch((error) => {
                    console.error("Turning on installment reminders failed", error);
                });
            },
            text: translateNow("installments.reminder.turnOn"),
        },
    ]);
}
