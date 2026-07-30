export const REMINDER_MORNING = 1;
export const REMINDER_EVENING = 2;
export const REMINDER_CUSTOM = 3;

export interface TimeOfDay {
	hour: number;
	minute: number;
}

const MORNING: TimeOfDay = { hour: 8, minute: 0 };
const EVENING: TimeOfDay = { hour: 20, minute: 0 };

export function clampTimeOfDay(hour: number, minute: number): TimeOfDay {
	if (!(Number.isFinite(hour) && Number.isFinite(minute))) {
		return MORNING;
	}
	return {
		hour: Math.min(23, Math.max(0, Math.floor(hour))),
		minute: Math.min(59, Math.max(0, Math.floor(minute))),
	};
}

export function reminderTime(option: number, custom: TimeOfDay): TimeOfDay {
	switch (option) {
		case REMINDER_EVENING:
			return EVENING;
		case REMINDER_CUSTOM:
			return custom;
		default:
			return MORNING;
	}
}

/**
 * Hand-rolled rather than `toLocaleTimeString`: Hermes ships without ICU, so
 * every locale would read back as the en-US default anyway.
 */
export function formatTimeOfDay({ hour, minute }: TimeOfDay): string {
	const suffix = hour < 12 ? "AM" : "PM";
	const twelve = hour % 12 === 0 ? 12 : hour % 12;
	return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export type ReminderPermission = "granted" | "denied" | "undetermined";

export type EnableReminderStep = "schedule" | "request" | "open-settings";

/**
 * iOS prompts once and never again. Once denied, the switch cannot be honoured
 * from inside the app at all, so the tap has to hand the user to Settings
 * instead of silently doing nothing.
 */
export function enableReminderStep(
	permission: ReminderPermission,
): EnableReminderStep {
	switch (permission) {
		case "granted":
			return "schedule";
		case "denied":
			return "open-settings";
		default:
			return "request";
	}
}

export type ReminderReconcile = "schedule" | "disable" | "none";

/**
 * The setting is a claim about what iOS will do, and iOS can be changed behind
 * the app's back. Anything short of `granted` makes the stored `true` a lie the
 * Settings row would keep repeating, so it is written back off.
 *
 * The granted branch re-arms rather than trusting the queue: a restore onto a
 * new device carries the setting across but not the pending request.
 */
export function reminderReconcile(
	enabled: boolean,
	permission: ReminderPermission,
): ReminderReconcile {
	if (!enabled) {
		return "none";
	}
	return permission === "granted" ? "schedule" : "disable";
}
