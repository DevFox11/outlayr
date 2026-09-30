import type { EntryRateType } from "@outlayr/money/rates";

import { addDays, formatSentenceDate, startOfDay } from "@/domain/dates";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { leadLabelKey } from "@/domain/subscription-reminder";
import type { LeadLabelKey } from "@/domain/subscription-reminder";
import type { TranslationKey } from "@/i18n/catalog";
import type { TranslateFn } from "@/i18n/context";
import type { Language } from "@/i18n/languages";

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

const BCV_CURRENCY = "VES";

export function quotedByBcv(...currencies: readonly string[]): boolean {
    return currencies.includes(BCV_CURRENCY);
}

const RATE_NAME_KEYS = {
    custom: "transaction.rate.custom",
    eur_reference: "transaction.rate.eur_reference",
    official: "transaction.rate.official",
} as const satisfies Record<EntryRateType, TranslationKey>;

const RATE_SOURCE_WORD_KEYS = {
    custom: "transaction.sentence.rateSource.custom",
    eur_reference: "transaction.sentence.rateSource.eur_reference",
    official: "transaction.sentence.rateSource.official",
} as const satisfies Record<EntryRateType, TranslationKey>;

/** Names the policy a stated conversion was produced by. */
export function rateNameKey(type: EntryRateType, bcv: boolean): TranslationKey {
    return bcv && type === "official" ? "transaction.rate.officialBcv" : RATE_NAME_KEYS[type];
}

export function rateSourceWordKey(type: EntryRateType, bcv: boolean): TranslationKey {
    return bcv && type === "official" ? "transaction.sentence.rateSource.officialBcv" : RATE_SOURCE_WORD_KEYS[type];
}

const NAMED_LIMIT = 28;

export function namedWithCount(names: readonly string[], limit = NAMED_LIMIT): string {
    let shown = 1;
    while (shown < names.length && names.slice(0, shown + 1).join(", ").length <= limit) {
        shown += 1;
    }
    const stated = names.slice(0, shown).join(", ");
    return shown === names.length ? stated : `${stated} +${names.length - shown}`;
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

interface WhenOptions {
    date: Date;
    /**
     * The cadence phrase for a subscription, already built by
     * {@link import("@/components/custom-schedule-sheet").intervalPhrase}, or
     * null for a one-off.
     */
    interval: string | null;
    language?: Language;
    now: Date;
}

/**
 * The sentence's closing phrase. A one-off says when it happened and a
 * subscription says how often it repeats, because those are the same fact about
 * the entry's timing and the sentence has one place to put it.
 */
export function transactionWhenLabel(t: TranslateFn, { date, interval, language, now }: WhenOptions): string {
    if (interval !== null) {
        return t("transaction.sentence.when.repeating", { date: formatSentenceDate(date, language), interval });
    }
    const midnight = startOfDay(now).getTime();
    const target = startOfDay(date).getTime();
    if (target === midnight) {
        return t("transaction.sentence.when.today");
    }
    if (target === addDays(new Date(midnight), -1).getTime()) {
        return t("transaction.sentence.when.yesterday");
    }
    return t("transaction.sentence.when.on", { date: formatSentenceDate(date, language) });
}
