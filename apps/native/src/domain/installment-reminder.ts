import type { TimeOfDay } from "./reminder";
import { reminderFireAt } from "./subscription-reminder";

/**
 * Off until someone turns it on in Settings, like the subscription notices.
 * Flipping it reaches only ledgers that already granted notifications: with
 * the permission undetermined, the reconcile writes the setting back off.
 */
export const INSTALLMENT_REMINDERS_DEFAULT = false;

/**
 * Its own namespace, so this reconcile cancels only the cuota notices and
 * leaves the daily reminder and the subscription notices to the settings that
 * own them.
 */
export const INSTALLMENT_REMINDER_PREFIX = "outlayr.cuota-due.";

/** Derived from the cuota's id, so a re-arm replaces its request instead of stacking. */
export function installmentReminderId(installmentId: string): string {
    return `${INSTALLMENT_REMINDER_PREFIX}${installmentId}`;
}

/** iOS keeps at most this many pending requests per app and silently drops the rest. */
const IOS_PENDING_LIMIT = 64;

/**
 * The cuotas take what the other reminders leave of iOS's limit, and at most
 * this many: the soonest ones, re-armed on every foreground as they fire.
 *
 * shortcut: a subscription sync outside the foreground pass (a saved entry, the
 * toggle) arms its 55 without counting the cuotas already pending, so the total
 * can pass the limit until the next foreground trims them; give each kind a
 * fixed share if a ledger ever holds that many subscription notices.
 */
const MAX_PENDING_INSTALLMENT_REMINDERS = 8;

export function installmentReminderCap(pendingIds: readonly string[]): number {
    const others = pendingIds.filter((id) => !id.startsWith(INSTALLMENT_REMINDER_PREFIX)).length;
    return Math.max(0, Math.min(MAX_PENDING_INSTALLMENT_REMINDERS, IOS_PENDING_LIMIT - others));
}

/**
 * The day before each unpaid cuota, at the reminder time, soonest first and
 * capped. A fire time already past is dropped: the cuota is due today or was
 * missed, which the order screen already says.
 */
export function cuotaReminders<Cuota extends { dueDate: Date; installmentId: string }>(
    cuotas: readonly Cuota[],
    now: Date,
    time: TimeOfDay,
    cap: number
): (Cuota & { fireAt: Date; id: string })[] {
    return cuotas
        .map((cuota) => ({
            ...cuota,
            fireAt: reminderFireAt(cuota.dueDate, 1, time),
            id: installmentReminderId(cuota.installmentId),
        }))
        .filter((cuota) => cuota.fireAt.getTime() > now.getTime())
        .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
        .slice(0, cap);
}

/** Pending cuota notices the plan no longer covers; everything outside the namespace stays. */
export function orphanedInstallmentReminderIds(armed: readonly string[], pendingIds: readonly string[]): string[] {
    const keep = new Set(armed);
    return pendingIds.filter((id) => id.startsWith(INSTALLMENT_REMINDER_PREFIX) && !keep.has(id));
}
