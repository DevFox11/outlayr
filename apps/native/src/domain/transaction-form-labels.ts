import { RECURRING_TYPE } from "@/domain/recurrence";
import { leadLabelKey } from "@/domain/subscription-reminder";
import type { LeadLabelKey } from "@/domain/subscription-reminder";
import type { TranslationKey } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";

// Keyed by a stored `recurringType`, which is a plain column value rather than
// a checked union, so an unknown one falls through to the caller's default.
const CADENCE_LABEL_KEY = new Map<number, TranslationKey>([
    [RECURRING_TYPE.daily, "transaction.cadence.daily"],
    [RECURRING_TYPE.weekly, "transaction.cadence.weekly"],
    [RECURRING_TYPE.monthly, "transaction.cadence.monthly"],
    [RECURRING_TYPE.yearly, "transaction.cadence.yearly"],
]);

export function cadenceLabel(t: TranslateFn, type: number): string {
    return t(CADENCE_LABEL_KEY.get(type) ?? "transaction.cadence.monthly");
}

export function ctaKey(mode: "create" | "edit", isSubscription: boolean): TranslationKey {
    if (mode === "edit") {
        return "transaction.cta.save";
    }
    return isSubscription ? "transaction.cta.addSubscription" : "transaction.cta.add";
}

/**
 * Only names what this screen calls each phrasing. Which phrasing a lead reads
 * as stays with {@link leadLabelKey}, including the counted fallback a lead the
 * picker never offered needs — one restored from another device. Several domain
 * keys therefore share a string: "2 days before" and "5 days before" are the
 * same counted form.
 */
const LEAD_LABEL_KEY = {
    "settings.notifications.leadDaysBefore": "transaction.remind.daysBefore",
    "settings.notifications.leadOff": "transaction.remind.off",
    "settings.notifications.leadOneDay": "transaction.remind.dayBefore",
    "settings.notifications.leadOneWeek": "transaction.remind.weekBefore",
    "settings.notifications.leadSameDay": "transaction.remind.sameDay",
    "settings.notifications.leadThreeDays": "transaction.remind.daysBefore",
    "settings.notifications.leadTwoDays": "transaction.remind.daysBefore",
} satisfies Record<LeadLabelKey, TranslationKey>;

export function leadLabel(t: TranslateFn, lead: number | null): string {
    // A null lead resolves to `remind.off`, which carries no `{count}`.
    return t(LEAD_LABEL_KEY[leadLabelKey(lead)], { count: lead ?? undefined });
}
