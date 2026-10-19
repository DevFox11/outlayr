import { startOfDay } from "@outlayr/money/calendar";

import { CATALOGS, EN } from "@/i18n/catalog";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";
import type { TranslationParams } from "@/i18n/translate";
import type { DatedReminder } from "@/lib/reminders";

import { dueDay, formatDueDay } from "./dates";
import { formatAmount } from "./money";
import { SUBSCRIPTION_REMINDER_PREFIX } from "./subscription-reminder";
import type { ArmedReminder } from "./subscription-reminder";

export interface ReminderCopyInput {
    account: string | null;
    amount: number;
    category: string | null;
    currency: string;
    fireAt: Date;
    income: boolean;
    landing: Date;
    note: string;
}

type ArmedReminderCopy = ReminderCopyInput & ArmedReminder & { amountUsd: number | null; chargeId: string };

const say = (key: string, language: Language, params?: TranslationParams) =>
    translate(key, { catalog: CATALOGS[language], fallback: EN, params });

const reminderName = (reminder: ReminderCopyInput, language: Language) =>
    reminder.note.trim() || reminder.category?.trim() || say("reminder.due.untitled", language);

/** With amounts hidden the title is the name alone, so the lock screen never shows the price. */
export function reminderCopy(
    reminder: ReminderCopyInput,
    hideAmounts: boolean,
    language: Language = runtimeLanguage()
) {
    const category = reminder.category?.trim();
    const name = reminderName(reminder, language);
    const amount = formatAmount(reminder.amount, reminder.currency, true, language);
    return {
        body: [
            formatDueDay(reminder.landing, reminder.fireAt, language),
            category?.toLowerCase() === name.toLowerCase() ? null : category,
            reminder.account,
        ]
            .filter(Boolean)
            .join(" · "),
        title: hideAmounts ? name : `${reminder.income ? "+" : ""}${amount} · ${name}`,
    };
}

function digestTitleKey(days: number) {
    if (days === 0) {
        return "reminder.digest.today";
    }
    return days === 1 ? "reminder.digest.tomorrow" : "reminder.digest.on";
}

function digestCopy(
    members: readonly [ArmedReminderCopy, ...ArmedReminderCopy[]],
    hideAmounts: boolean,
    language: Language
) {
    const [{ fireAt, landing }] = members;
    const { days, name } = dueDay(landing, fireAt, language);
    return {
        body: members
            .map((member) => ({ ...member, name: reminderName(member, language) }))
            .sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1) || a.name.localeCompare(b.name))
            .map((member) =>
                hideAmounts
                    ? member.name
                    : `${member.name} ${formatAmount(member.amount, member.currency, true, language)}`
            )
            .join(" · "),
        title: say(digestTitleKey(days), language, { count: members.length, day: name }),
    };
}

export function reminderNotices(
    plan: readonly ArmedReminderCopy[],
    hideAmounts: boolean,
    language: Language = runtimeLanguage()
) {
    const groups = new Map<string, [ArmedReminderCopy, ...ArmedReminderCopy[]]>();
    for (const reminder of plan) {
        const key = reminder.income
            ? reminder.id
            : `${SUBSCRIPTION_REMINDER_PREFIX}digest.${reminder.fireAt.getTime()}.${startOfDay(reminder.landing).getTime()}`;
        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, [reminder]);
        } else {
            group.push(reminder);
        }
    }
    return Array.from(groups, ([id, members]): DatedReminder => {
        const [first] = members;
        if (members.length === 1) {
            return {
                ...reminderCopy(first, hideAmounts, language),
                data: { charge: first.chargeId, subscription: first.localId },
                fireAt: first.fireAt,
                id: first.id,
            };
        }
        return { ...digestCopy(members, hideAmounts, language), data: { open: "log" }, fireAt: first.fireAt, id };
    });
}
