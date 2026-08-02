import {
	type LeadLabelKey,
	leadLabelKey,
} from "@/domain/subscription-reminder";
import type { TranslateFn, TranslationKey } from "@/i18n";

export function ctaKey(
	mode: "create" | "edit",
	isSubscription: boolean,
): TranslationKey {
	if (mode === "edit") {
		return "transaction.cta.save";
	}
	return isSubscription
		? "transaction.cta.addSubscription"
		: "transaction.cta.add";
}

/**
 * Only names what this screen calls each phrasing. Which phrasing a lead reads
 * as stays with {@link leadLabelKey}, including the counted fallback a lead the
 * picker never offered needs — one restored from another device. Several domain
 * keys therefore share a string: "2 days before" and "5 days before" are the
 * same counted form.
 */
const LEAD_LABEL_KEY: Record<LeadLabelKey, TranslationKey> = {
	"settings.notifications.leadOff": "transaction.remind.off",
	"settings.notifications.leadSameDay": "transaction.remind.sameDay",
	"settings.notifications.leadOneDay": "transaction.remind.dayBefore",
	"settings.notifications.leadTwoDays": "transaction.remind.daysBefore",
	"settings.notifications.leadThreeDays": "transaction.remind.daysBefore",
	"settings.notifications.leadOneWeek": "transaction.remind.weekBefore",
	"settings.notifications.leadDaysBefore": "transaction.remind.daysBefore",
};

export function leadLabel(t: TranslateFn, lead: number | null): string {
	return t(LEAD_LABEL_KEY[leadLabelKey(lead)], { count: lead });
}
