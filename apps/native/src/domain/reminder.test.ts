import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
		assert.deepEqual(reminderTime(REMINDER_MORNING, custom), {
			hour: 8,
			minute: 0,
		});
		assert.deepEqual(reminderTime(REMINDER_EVENING, custom), {
			hour: 20,
			minute: 0,
		});
	});

	it("uses the stored time only on the custom option", () => {
		assert.deepEqual(reminderTime(REMINDER_CUSTOM, { hour: 13, minute: 45 }), {
			hour: 13,
			minute: 45,
		});
	});

	it("falls back to the morning for an option nothing offers", () => {
		assert.deepEqual(reminderTime(99, { hour: 13, minute: 45 }), {
			hour: 8,
			minute: 0,
		});
	});

	it("clamps a stored time that could never fire", () => {
		assert.deepEqual(clampTimeOfDay(25, 70), { hour: 23, minute: 59 });
		assert.deepEqual(clampTimeOfDay(-3, -1), { hour: 0, minute: 0 });
		assert.deepEqual(clampTimeOfDay(9.7, 30.2), { hour: 9, minute: 30 });
		assert.deepEqual(clampTimeOfDay(Number.NaN, Number.NaN), {
			hour: 8,
			minute: 0,
		});
	});

	it("carries a clamped custom time through", () => {
		assert.deepEqual(reminderTime(REMINDER_CUSTOM, clampTimeOfDay(99, 99)), {
			hour: 23,
			minute: 59,
		});
	});
});

describe("time of day label", () => {
	it("reads back in the 12-hour form the option rows use", () => {
		assert.equal(formatTimeOfDay({ hour: 8, minute: 0 }), "8:00 AM");
		assert.equal(formatTimeOfDay({ hour: 20, minute: 0 }), "8:00 PM");
	});

	it("names both ends of the day without a zero hour", () => {
		assert.equal(formatTimeOfDay({ hour: 0, minute: 5 }), "12:05 AM");
		assert.equal(formatTimeOfDay({ hour: 12, minute: 30 }), "12:30 PM");
	});

	it("pads the minute", () => {
		assert.equal(formatTimeOfDay({ hour: 9, minute: 7 }), "9:07 AM");
	});
});

describe("turning reminders on", () => {
	it("asks iOS the first time", () => {
		assert.equal(enableReminderStep("undetermined"), "request");
	});

	it("schedules straight away once granted", () => {
		assert.equal(enableReminderStep("granted"), "schedule");
	});

	it("sends a denied user to iOS Settings, the only place that can undo it", () => {
		assert.equal(enableReminderStep("denied"), "open-settings");
	});
});

describe("reconciling a stored setting against iOS", () => {
	it("re-arms the schedule when the permission still holds", () => {
		assert.equal(reminderReconcile(true, "granted"), "schedule");
	});

	it("turns the setting off when the permission was revoked outside the app", () => {
		assert.equal(reminderReconcile(true, "denied"), "disable");
		assert.equal(reminderReconcile(true, "undetermined"), "disable");
	});

	it("leaves an already-off setting alone whatever iOS says", () => {
		assert.equal(reminderReconcile(false, "granted"), "none");
		assert.equal(reminderReconcile(false, "denied"), "none");
		assert.equal(reminderReconcile(false, "undetermined"), "none");
	});
});
