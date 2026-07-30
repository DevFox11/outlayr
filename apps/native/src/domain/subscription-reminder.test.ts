import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isSubscriptionReminderId,
	leadLabelKey,
	MAX_PENDING_SUBSCRIPTION_REMINDERS,
	normalizeLead,
	orphanedReminderIds,
	REMINDER_LEAD_OPTIONS,
	reminderFireAt,
	reminderPlan,
	SUBSCRIPTION_REMINDER_PREFIX,
	subscriptionReminderId,
} from "./subscription-reminder";

const NINE_AM = { hour: 9, minute: 0 };

const wallClock = (
	d: Date,
): [number, number, number, number, number, number] => [
	d.getFullYear(),
	d.getMonth() + 1,
	d.getDate(),
	d.getHours(),
	d.getMinutes(),
	d.getSeconds(),
];

describe("subscription reminder identity", () => {
	it("namespaces the request under the local id", () => {
		assert.equal(
			subscriptionReminderId("abc-123"),
			`${SUBSCRIPTION_REMINDER_PREFIX}abc-123`,
		);
	});

	it("claims its own requests and nothing else", () => {
		assert.equal(isSubscriptionReminderId(subscriptionReminderId("abc")), true);
		assert.equal(isSubscriptionReminderId("outlayr.daily-reminder"), false);
		assert.equal(isSubscriptionReminderId("outlayr.sub-due"), false);
		assert.equal(isSubscriptionReminderId(""), false);
	});
});

describe("lead options", () => {
	it("offers the picker's order, on the day first", () => {
		assert.deepEqual([...REMINDER_LEAD_OPTIONS], [0, 1, 2, 3, 7]);
	});
});

describe("normalizing a stored lead", () => {
	it("reads a missing lead as off rather than as the due day", () => {
		assert.equal(normalizeLead(null), null);
	});

	it("keeps every offered option untouched", () => {
		for (const lead of REMINDER_LEAD_OPTIONS) {
			assert.equal(normalizeLead(lead), lead);
		}
	});

	it("refuses a lead that is not a real number", () => {
		assert.equal(normalizeLead(Number.NaN), null);
		assert.equal(normalizeLead(Number.POSITIVE_INFINITY), null);
		assert.equal(normalizeLead(Number.NEGATIVE_INFINITY), null);
	});

	it("clamps both ends instead of turning the reminder off", () => {
		assert.equal(normalizeLead(-3), 0);
		assert.equal(normalizeLead(99), 30);
		assert.equal(normalizeLead(30), 30);
	});

	it("floors a fractional lead", () => {
		assert.equal(normalizeLead(2.9), 2);
	});
});

describe("when a reminder fires", () => {
	it("lands on the due day at the configured hour with no lead", () => {
		const fire = reminderFireAt(new Date(2026, 4, 14, 23, 12), 0, NINE_AM);
		assert.deepEqual(wallClock(fire), [2026, 5, 14, 9, 0, 0]);
	});

	it("lands a week earlier at a week's lead", () => {
		const fire = reminderFireAt(new Date(2026, 4, 14), 7, NINE_AM);
		assert.deepEqual(wallClock(fire), [2026, 5, 7, 9, 0, 0]);
	});

	it("carries the chosen minute through", () => {
		const fire = reminderFireAt(new Date(2026, 4, 14), 1, {
			hour: 20,
			minute: 45,
		});
		assert.deepEqual(wallClock(fire), [2026, 5, 13, 20, 45, 0]);
	});

	it("crosses a month boundary onto the right day", () => {
		const fire = reminderFireAt(new Date(2026, 2, 3), 7, NINE_AM);
		assert.deepEqual(wallClock(fire), [2026, 2, 24, 9, 0, 0]);
	});

	it("crosses a year boundary onto the right day", () => {
		const fire = reminderFireAt(new Date(2026, 0, 2), 3, NINE_AM);
		assert.deepEqual(wallClock(fire), [2025, 12, 30, 9, 0, 0]);
	});

	// The zone is forced because the host's own may have no DST at all, in which
	// case the case under test could not arise. `node --test` runs each file in
	// its own process, so the mutation cannot reach another test file.
	it("keeps the chosen hour across a DST change", () => {
		const zone = process.env.TZ;
		process.env.TZ = "America/New_York";
		try {
			assert.notEqual(
				new Date(2026, 2, 15).getTimezoneOffset(),
				new Date(2026, 2, 1).getTimezoneOffset(),
				"the forced zone must actually shift between the two dates",
			);
			const fire = reminderFireAt(new Date(2026, 2, 15), 7, NINE_AM);
			assert.deepEqual(wallClock(fire), [2026, 3, 8, 9, 0, 0]);
		} finally {
			process.env.TZ = zone;
		}
	});
});

describe("planning what to arm", () => {
	const now = new Date(2026, 2, 10, 12, 0);

	it("drops a charge whose reminder hour has already gone by", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "past", landing: new Date(2026, 2, 10), leadDays: 0 },
				{ localId: "ahead", landing: new Date(2026, 2, 12), leadDays: 0 },
			],
			now,
			time: NINE_AM,
		});
		assert.deepEqual(
			plan.arm.map((armed) => armed.localId),
			["ahead"],
		);
	});

	it("drops a lead that pulls the reminder back before now", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "led-past", landing: new Date(2026, 2, 12), leadDays: 7 },
			],
			now,
			time: NINE_AM,
		});
		assert.deepEqual(plan.arm, []);
	});

	it("arms nothing for a candidate whose lead is off", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "off", landing: new Date(2026, 2, 12), leadDays: null },
			],
			now,
			time: NINE_AM,
		});
		assert.deepEqual(plan.arm, []);
	});

	it("clamps a negative lead instead of firing after the charge", () => {
		const landing = new Date(2026, 2, 12);
		const plan = reminderPlan({
			candidates: [{ localId: "backwards", landing, leadDays: -3 }],
			now,
			time: NINE_AM,
		});
		// -3 counted forward would land on the 15th, three days after the money
		// left — and it would survive the `now` filter, so nothing else catches it.
		assert.equal(plan.arm.length, 1);
		assert.deepEqual(plan.arm[0].fireAt, new Date(2026, 2, 12, 9, 0));
	});

	it("orders by fire time, not by the order the rows arrived", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "june", landing: new Date(2026, 5, 1), leadDays: 0 },
				{ localId: "april", landing: new Date(2026, 3, 1), leadDays: 0 },
				{ localId: "may-led", landing: new Date(2026, 4, 1), leadDays: 3 },
			],
			now,
			time: NINE_AM,
		});
		assert.deepEqual(
			plan.arm.map((armed) => armed.localId),
			["april", "may-led", "june"],
		);
	});

	it("keeps the soonest charges when it has to truncate", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "third", landing: new Date(2026, 2, 20), leadDays: 0 },
				{ localId: "first", landing: new Date(2026, 2, 11), leadDays: 0 },
				{ localId: "second", landing: new Date(2026, 2, 15), leadDays: 0 },
			],
			now,
			time: NINE_AM,
			cap: 2,
		});
		assert.deepEqual(
			plan.arm.map((armed) => armed.localId),
			["first", "second"],
		);
	});

	it("arms nothing at all rather than one request at a cap of zero", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "ahead", landing: new Date(2026, 2, 12), leadDays: 0 },
			],
			now,
			time: NINE_AM,
			cap: 0,
		});
		assert.deepEqual(plan.arm, []);
	});

	it("caps at the iOS budget when no cap is given", () => {
		const candidates = Array.from({ length: 80 }, (_, index) => ({
			localId: `sub-${index}`,
			landing: new Date(2026, 2, 11 + index),
			leadDays: 0,
		}));
		const plan = reminderPlan({ candidates, now, time: NINE_AM });
		assert.equal(plan.arm.length, MAX_PENDING_SUBSCRIPTION_REMINDERS);
		assert.equal(plan.arm[0].localId, "sub-0");
	});

	it("names each request by its own local id", () => {
		const plan = reminderPlan({
			candidates: [
				{ localId: "abc", landing: new Date(2026, 2, 12), leadDays: 0 },
			],
			now,
			time: NINE_AM,
		});
		assert.equal(plan.arm[0].id, subscriptionReminderId("abc"));
		assert.deepEqual(wallClock(plan.arm[0].fireAt), [2026, 3, 12, 9, 0, 0]);
	});
});

describe("reconciling what iOS still holds", () => {
	it("returns a subscription request the plan no longer covers", () => {
		const armed = [subscriptionReminderId("keep")];
		const pending = [
			subscriptionReminderId("keep"),
			subscriptionReminderId("stale"),
		];
		assert.deepEqual(orphanedReminderIds(armed, pending), [
			subscriptionReminderId("stale"),
		]);
	});

	it("never touches the daily reminder", () => {
		const pending = [
			"outlayr.daily-reminder",
			subscriptionReminderId("stale"),
			"some.other.app.request",
		];
		assert.deepEqual(orphanedReminderIds([], pending), [
			subscriptionReminderId("stale"),
		]);
		assert.deepEqual(
			orphanedReminderIds([subscriptionReminderId("stale")], pending),
			[],
		);
	});

	it("cancels nothing when iOS holds nothing", () => {
		assert.deepEqual(
			orphanedReminderIds([subscriptionReminderId("keep")], []),
			[],
		);
	});
});

describe("labelling a lead", () => {
	it("names every option the picker offers", () => {
		assert.equal(leadLabelKey(null), "settings.notifications.leadOff");
		assert.equal(leadLabelKey(0), "settings.notifications.leadSameDay");
		assert.equal(leadLabelKey(1), "settings.notifications.leadOneDay");
		assert.equal(leadLabelKey(2), "settings.notifications.leadTwoDays");
		assert.equal(leadLabelKey(3), "settings.notifications.leadThreeDays");
		assert.equal(leadLabelKey(7), "settings.notifications.leadOneWeek");
	});

	it("falls back to the counted form for a lead nothing offers", () => {
		assert.equal(leadLabelKey(5), "settings.notifications.leadDaysBefore");
		assert.equal(leadLabelKey(30), "settings.notifications.leadDaysBefore");
	});

	it("reads a nonsense lead as off, matching what is stored back", () => {
		assert.equal(leadLabelKey(Number.NaN), "settings.notifications.leadOff");
	});

	it("labels a clamped lead by the value that will actually be used", () => {
		assert.equal(leadLabelKey(-3), "settings.notifications.leadSameDay");
		assert.equal(leadLabelKey(1.5), "settings.notifications.leadOneDay");
	});
});
