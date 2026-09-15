import type { Language } from "@/i18n/languages";
import { runtimeLanguage } from "@/i18n/runtime";

import { formatTime } from "./dates";

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
        case REMINDER_EVENING: {
            return EVENING;
        }
        case REMINDER_CUSTOM: {
            return custom;
        }
        default: {
            return MORNING;
        }
    }
}

/**
 * The reminder's time, written the way every other clock in the app is.
 *
 * `formatTime` takes a `Date` because that is what its callers hold; a reminder
 * is a wall-clock time with no day attached, so one is stood up here. It is
 * still hand-rolled underneath rather than `toLocaleTimeString`, because Hermes
 * ships without ICU and every locale would read back as the en-US default.
 */
export function formatTimeOfDay(
    { hour, minute }: TimeOfDay,
    use24Hour = false,
    language: Language = runtimeLanguage()
): string {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    return formatTime(at, use24Hour, language);
}

export type ReminderPermission = "granted" | "denied" | "undetermined";

export type EnableReminderStep = "schedule" | "request" | "open-settings";

/**
 * iOS prompts once and never again. Once denied, the switch cannot be honoured
 * from inside the app at all, so the tap has to hand the user to Settings
 * instead of silently doing nothing.
 */
export function enableReminderStep(permission: ReminderPermission): EnableReminderStep {
    switch (permission) {
        case "granted": {
            return "schedule";
        }
        case "denied": {
            return "open-settings";
        }
        default: {
            return "request";
        }
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
export function reminderReconcile(enabled: boolean, permission: ReminderPermission): ReminderReconcile {
    if (!enabled) {
        return "none";
    }
    return permission === "granted" ? "schedule" : "disable";
}
