import { useEffect } from "react";
import { AppState } from "react-native";

import { readBoolSetting, setBoolSetting } from "@/data/settings-core";
import { pendingReminderPlan } from "@/data/subscription-reminders-core";
import type { Database } from "@/db/client";
import { formatUpcomingDate } from "@/domain/dates";
import { formatAmount } from "@/domain/money";
import { reminderReconcile } from "@/domain/reminder";
import { orphanedReminderIds } from "@/domain/subscription-reminder";
import { translateNow } from "@/i18n/runtime";

import { readReminderTime } from "./reminder-sync";
import { cancelReminders, pendingReminderIds, reminderPermission, scheduleDatedReminder } from "./reminders";

/**
 * Reconciles iOS's pending queue with the subscriptions that asked to be
 * announced. Every arm is recomputed from the ledger rather than trusted: a
 * chain's next landing moves each time a charge is backfilled, and a restore
 * carries the rows across but not the requests.
 *
 * Cancellation runs whatever the switch says, so turning it off — or deleting
 * the subscription behind a pending notice — actually silences iOS. Only
 * identifiers inside the subscription namespace are touched; the daily reminder
 * is a different setting's promise.
 */
export function syncSubscriptionReminders(db: Database): Promise<void> {
    const run = queue.then(() => reconcileSubscriptionReminders(db));
    queue = run.catch(() => {
        // Swallowed so one failed sync does not poison the queue.
    });
    return run;
}

/**
 * Reconciles run one at a time. Several callers can ask on the same foreground —
 * the mount, the AppState listener, and the recurrence sweep once it commits —
 * and two overlapping passes interleave their cancels and schedules, so one can
 * cancel a request the other has just armed.
 *
 * `catch` keeps the chain alive: without it a single failed pass would wedge
 * every later one behind a permanently rejected promise.
 */
let queue: Promise<unknown> = Promise.resolve();

async function reconcileSubscriptionReminders(db: Database): Promise<void> {
    const [enabled, permission] = await Promise.all([
        readBoolSetting(db, "subscriptionReminders"),
        reminderPermission(),
    ]);
    const decision = reminderReconcile(enabled, permission);
    const armed = decision === "schedule" ? await pendingReminderPlan(db, new Date(), await readReminderTime(db)) : [];

    await cancelReminders(
        orphanedReminderIds(
            armed.map((reminder) => reminder.id),
            await pendingReminderIds()
        )
    );

    for (const reminder of armed) {
        // oxlint-disable-next-line no-await-in-loop -- arming mutates the one shared iOS notification queue, which is why `cancelReminders` (lib/reminders.ts) walks it serially too
        await scheduleDatedReminder({
            body: translateNow("reminder.due.body", {
                amount: formatAmount(reminder.amount, reminder.currency),
                date: formatUpcomingDate(reminder.landing),
            }),
            fireAt: reminder.fireAt,
            id: reminder.id,
            title: reminder.note.trim() || translateNow("reminder.due.untitled"),
        });
    }

    if (decision === "disable") {
        await setBoolSetting(db, "subscriptionReminders", false);
    }
}

/**
 * Mounted app-wide, not per screen: the arms are dated, so a device left alone
 * for a month would otherwise come back with a queue describing charges that
 * have already been taken.
 */
export function useSubscriptionReminderSync(db: Database): void {
    useEffect(() => {
        const sweep = () => {
            syncSubscriptionReminders(db).catch((error) => {
                console.error("Subscription reminder sync failed", error);
            });
        };

        sweep();

        const subscription = AppState.addEventListener("change", (state) => {
            if (state === "active") {
                sweep();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [db]);
}
