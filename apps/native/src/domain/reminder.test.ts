import { describe, expect, it } from "@jest/globals";

import {
    clampTimeOfDay,
    enableReminderStep,
    formatTimeOfDay,
    REMINDER_CUSTOM,
    REMINDER_EVENING,
    REMINDER_MORNING,
    reminderReconcile,
    reminderTime,
} from "./reminder";

describe("reminder time", () => {
    it("pins the two fixed options to the hours Swift offered", () => {
        const custom = { hour: 13, minute: 45 };
        expect(reminderTime(REMINDER_MORNING, custom)).toStrictEqual({
            hour: 8,
            minute: 0,
        });
        expect(reminderTime(REMINDER_EVENING, custom)).toStrictEqual({
            hour: 20,
            minute: 0,
        });
    });

    it("uses the stored time only on the custom option", () => {
        expect(reminderTime(REMINDER_CUSTOM, { hour: 13, minute: 45 })).toStrictEqual({
            hour: 13,
            minute: 45,
        });
    });

    it("falls back to the morning for an option nothing offers", () => {
        expect(reminderTime(99, { hour: 13, minute: 45 })).toStrictEqual({
            hour: 8,
            minute: 0,
        });
    });

    it("clamps a stored time that could never fire", () => {
        expect(clampTimeOfDay(25, 70)).toStrictEqual({ hour: 23, minute: 59 });
        expect(clampTimeOfDay(-3, -1)).toStrictEqual({ hour: 0, minute: 0 });
        expect(clampTimeOfDay(9.7, 30.2)).toStrictEqual({ hour: 9, minute: 30 });
        expect(clampTimeOfDay(Number.NaN, Number.NaN)).toStrictEqual({
            hour: 8,
            minute: 0,
        });
    });

    it("carries a clamped custom time through", () => {
        expect(reminderTime(REMINDER_CUSTOM, clampTimeOfDay(99, 99))).toStrictEqual({
            hour: 23,
            minute: 59,
        });
    });
});

describe("time of day label", () => {
    it("reads back in the 12-hour form the option rows use", () => {
        expect(formatTimeOfDay({ hour: 8, minute: 0 })).toBe("8:00 AM");
        expect(formatTimeOfDay({ hour: 20, minute: 0 })).toBe("8:00 PM");
    });

    it("names both ends of the day without a zero hour", () => {
        expect(formatTimeOfDay({ hour: 0, minute: 5 })).toBe("12:05 AM");
        expect(formatTimeOfDay({ hour: 12, minute: 30 })).toBe("12:30 PM");
    });

    it("pads the minute", () => {
        expect(formatTimeOfDay({ hour: 9, minute: 7 })).toBe("9:07 AM");
    });

    it("writes the meridiem in the reader's language", () => {
        expect(formatTimeOfDay({ hour: 20, minute: 0 }, false, "es")).toBe("8:00 p. m.");
        expect(formatTimeOfDay({ hour: 8, minute: 0 }, false, "es")).toBe("8:00 a. m.");
    });

    it("honours the 24-hour clock the rest of the app already honours", () => {
        expect(formatTimeOfDay({ hour: 20, minute: 0 }, true)).toBe("20:00");
        expect(formatTimeOfDay({ hour: 8, minute: 5 }, true)).toBe("08:05");
    });
});

describe("turning reminders on", () => {
    it("asks iOS the first time", () => {
        expect(enableReminderStep("undetermined")).toBe("request");
    });

    it("schedules straight away once granted", () => {
        expect(enableReminderStep("granted")).toBe("schedule");
    });

    it("sends a denied user to iOS Settings, the only place that can undo it", () => {
        expect(enableReminderStep("denied")).toBe("open-settings");
    });

    it("sends a user whose permission could not be read to iOS Settings rather than silently doing nothing", () => {
        expect(enableReminderStep("unknown")).toBe("open-settings");
    });
});

describe("reconciling a stored setting against iOS", () => {
    it("re-arms the schedule when the permission still holds", () => {
        expect(reminderReconcile(true, "granted")).toBe("schedule");
    });

    it("turns the setting off when the permission was revoked outside the app", () => {
        expect(reminderReconcile(true, "denied")).toBe("disable");
        expect(reminderReconcile(true, "undetermined")).toBe("disable");
    });

    it("does nothing when the permission could not be read at all", () => {
        expect(reminderReconcile(true, "unknown")).toBe("none");
    });

    it("leaves an already-off setting alone whatever iOS says", () => {
        expect(reminderReconcile(false, "granted")).toBe("none");
        expect(reminderReconcile(false, "denied")).toBe("none");
        expect(reminderReconcile(false, "undetermined")).toBe("none");
        expect(reminderReconcile(false, "unknown")).toBe("none");
    });
});
