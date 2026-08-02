import { addDays } from "./dates";
import type { TimeOfDay } from "./reminder";

/**
 * Namespaced so reconciliation can tell the charges it owns apart from
 * `outlayr.daily-reminder`, which a different setting schedules and which has to
 * survive every subscription sweep.
 */
export const SUBSCRIPTION_REMINDER_PREFIX = "outlayr.sub-due.";

/** Derived from the local id so a re-arm replaces its request instead of stacking. */
export function subscriptionReminderId(localId: string): string {
	return `${SUBSCRIPTION_REMINDER_PREFIX}${localId}`;
}

export function isSubscriptionReminderId(id: string): boolean {
	return id.startsWith(SUBSCRIPTION_REMINDER_PREFIX);
}

/** In the order the picker renders them. */
export const REMINDER_LEAD_OPTIONS: readonly number[] = [0, 1, 2, 3, 7];

const MAX_LEAD_DAYS = 30;

/**
 * `null` is the off state and has to stay distinguishable from `0`, which means
 * "on the due day itself" — a lead the picker actually offers.
 */
export function normalizeLead(raw: number | null): number | null {
	if (raw == null || !Number.isFinite(raw)) {
		return null;
	}
	return Math.min(MAX_LEAD_DAYS, Math.max(0, Math.floor(raw)));
}

/**
 * A SwiftUI `Picker`'s tag set has to be one type, so Off rides along as
 * `offTag` rather than a real lead count; this turns the raw selection back
 * into `null` before it reaches {@link normalizeLead}.
 */
export function resolveLeadSelection(
	tag: number,
	offTag: number,
): number | null {
	return tag === offTag ? null : normalizeLead(tag);
}

/**
 * Whole days back, then the wall-clock hour set outright: a DST change between
 * the fire date and the due date would otherwise shift the reminder an hour off
 * the time the owner picked.
 */
export function reminderFireAt(
	landing: Date,
	leadDays: number,
	time: TimeOfDay,
): Date {
	const fire = addDays(landing, -leadDays);
	fire.setHours(time.hour, time.minute, 0, 0);
	return fire;
}

/**
 * iOS keeps at most 64 pending requests per app and silently discards every
 * later one, so subscriptions stop short of the ceiling: the headroom belongs to
 * the daily reminder and to anything else the app comes to schedule.
 */
export const MAX_PENDING_SUBSCRIPTION_REMINDERS = 55;

export interface ReminderCandidate {
	localId: string;
	landing: Date;
	/** Off, so a candidate carrying `null` arms nothing rather than firing on the day. */
	leadDays: number | null;
}

export interface ArmedReminder {
	id: string;
	localId: string;
	fireAt: Date;
}

export interface ReminderPlanInput {
	candidates: readonly ReminderCandidate[];
	now: Date;
	time: TimeOfDay;
	cap?: number;
}

export interface ReminderPlan {
	arm: ArmedReminder[];
}

/**
 * A fire time that has already passed is dropped, not nudged forward: iOS never
 * delivers a DATE trigger dated in the past, and moving it would announce a
 * charge the ledger has already taken.
 *
 * Sorted ascending before the cap so the requests that survive it are the
 * soonest ones — a truncation that kept an arbitrary slice would silently lose
 * this week's charge to one a year out.
 *
 * Each lead goes through {@link normalizeLead} first. A negative one would
 * otherwise count *forward* from the due day, and a reminder dated after the
 * charge still passes the `now` filter — the one outcome the paragraph above
 * exists to prevent.
 */
export function reminderPlan({
	candidates,
	now,
	time,
	cap = MAX_PENDING_SUBSCRIPTION_REMINDERS,
}: ReminderPlanInput): ReminderPlan {
	const arm = candidates
		.flatMap((candidate) => {
			const lead = normalizeLead(candidate.leadDays);
			if (lead === null) {
				return [];
			}
			return [
				{
					id: subscriptionReminderId(candidate.localId),
					localId: candidate.localId,
					fireAt: reminderFireAt(candidate.landing, lead, time),
				},
			];
		})
		.filter((armed) => armed.fireAt.getTime() > now.getTime())
		.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
	return { arm: arm.slice(0, Math.max(0, cap)) };
}

/**
 * Pending requests inside the subscription namespace that the plan no longer
 * covers. Everything outside it is left standing — cancelling
 * `outlayr.daily-reminder` here would turn the setting that owns it into a lie.
 */
export function orphanedReminderIds(
	armed: readonly string[],
	pendingIds: readonly string[],
): string[] {
	const keep = new Set(armed);
	return pendingIds.filter(
		(id) => isSubscriptionReminderId(id) && !keep.has(id),
	);
}

/**
 * Its own union rather than `TranslationKey`: the strings arrive with the
 * notification settings screen, and naming a key the catalogue does not hold yet
 * fails the typecheck here. The screen's `t()` call re-checks it against the
 * catalogue, so the guarantee is not lost, only deferred to the call site.
 */
export type LeadLabelKey =
	| "settings.notifications.leadOff"
	| "settings.notifications.leadSameDay"
	| "settings.notifications.leadOneDay"
	| "settings.notifications.leadTwoDays"
	| "settings.notifications.leadThreeDays"
	| "settings.notifications.leadOneWeek"
	| "settings.notifications.leadDaysBefore";

/**
 * Anything off the offered set reads through the counted form: a lead restored
 * from a synced device the picker never offered still has to name itself.
 */
export function leadLabelKey(lead: number | null): LeadLabelKey {
	switch (normalizeLead(lead)) {
		case null:
			return "settings.notifications.leadOff";
		case 0:
			return "settings.notifications.leadSameDay";
		case 1:
			return "settings.notifications.leadOneDay";
		case 2:
			return "settings.notifications.leadTwoDays";
		case 3:
			return "settings.notifications.leadThreeDays";
		case 7:
			return "settings.notifications.leadOneWeek";
		default:
			return "settings.notifications.leadDaysBefore";
	}
}
