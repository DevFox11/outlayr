import { CATALOGS, EN } from "@/i18n/catalog";
import type { TranslatableKey } from "@/i18n/catalog";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";
import type { TranslationParams } from "@/i18n/translate";
import type { DatedReminder } from "@/lib/reminders";

import { formatAmount } from "./money";
import type { TimeOfDay } from "./reminder";
import { reminderFireAt } from "./subscription-reminder";

/**
 * Off until someone turns it on, in Settings or when a saved order asks.
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
 * shortcut: a subscription sync outside the ordered pass (a saved entry) arms
 * its 55 without counting the cuotas already pending, so the total can pass the
 * limit until the next foreground or setting change trims them; give each kind
 * a fixed share if a ledger ever holds that many subscription notices.
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

export interface CuotaNoticeInput {
    account: string;
    amount: number;
    currency: string;
    fireAt: Date;
    id: string;
    order: string;
    planId: string;
}

/**
 * "Nike Air at Traki is due tomorrow" / "$30.00 to Cashea. Tap when it's paid.",
 * with the amount left off when amounts are hidden.
 */
export function cuotaNotice(
    cuota: CuotaNoticeInput,
    hideAmounts: boolean,
    language: Language = runtimeLanguage()
): DatedReminder {
    const say = (key: TranslatableKey, params: TranslationParams) =>
        translate(key, { catalog: CATALOGS[language], fallback: EN, params });
    return {
        body: hideAmounts
            ? say("installments.reminder.bodyHidden", { account: cuota.account })
            : say("installments.reminder.body", {
                  account: cuota.account,
                  amount: formatAmount(cuota.amount, cuota.currency, true, language),
              }),
        data: { open: "installment", plan: cuota.planId },
        fireAt: cuota.fireAt,
        id: cuota.id,
        title: say("installments.reminder.title", { order: cuota.order }),
    };
}

/** Pending cuota notices the plan no longer covers; everything outside the namespace stays. */
export function orphanedInstallmentReminderIds(armed: readonly string[], pendingIds: readonly string[]): string[] {
    const keep = new Set(armed);
    return pendingIds.filter((id) => id.startsWith(INSTALLMENT_REMINDER_PREFIX) && !keep.has(id));
}
