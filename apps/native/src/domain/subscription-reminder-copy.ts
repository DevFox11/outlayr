import { CATALOGS, EN } from "@/i18n/catalog";
import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";
import { translate } from "@/i18n/translate";

import { formatDueDay } from "./dates";
import { formatAmount } from "./money";

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

export function reminderCopy(reminder: ReminderCopyInput, language: Language = runtimeLanguage()) {
    const note = reminder.note.trim();
    const category = reminder.category?.trim();
    const name = note || category || translate("reminder.due.untitled", { catalog: CATALOGS[language], fallback: EN });
    const amount = formatAmount(reminder.amount, reminder.currency, true, language);
    return {
        body: [
            formatDueDay(reminder.landing, reminder.fireAt, language),
            category?.toLowerCase() === name.toLowerCase() ? null : category,
            reminder.account,
        ]
            .filter(Boolean)
            .join(" · "),
        title: `${reminder.income ? "+" : ""}${amount} · ${name}`,
    };
}
