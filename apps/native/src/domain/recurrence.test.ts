import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	cadenceUnit,
	nextDate,
	nextLanding,
	RECURRING_TYPE,
} from "./recurrence";

const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

const ymd = (d: Date | null): [number, number, number] | null =>
	d == null ? null : [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("advancing one occurrence", () => {
	it("advances each cadence by its own unit", () => {
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 1)),
			[2026, 3, 11],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.weekly, 1)),
			[2026, 3, 17],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.monthly, 1)),
			[2026, 4, 10],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.yearly, 1)),
			[2027, 3, 10],
		);
	});

	it("multiplies by the coefficient", () => {
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 5)),
			[2026, 3, 15],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.weekly, 2)),
			[2026, 3, 24],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.monthly, 3)),
			[2026, 6, 10],
		);
	});

	it("clamps a day the target month does not have", () => {
		assert.deepEqual(
			ymd(nextDate(at(2026, 1, 31), RECURRING_TYPE.monthly, 1)),
			[2026, 2, 28],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 31), RECURRING_TYPE.monthly, 1)),
			[2026, 4, 30],
		);
		assert.deepEqual(
			ymd(nextDate(at(2024, 2, 29), RECURRING_TYPE.yearly, 1)),
			[2025, 2, 28],
		);
	});

	it("keeps the charge's time of day", () => {
		const advanced = nextDate(
			new Date(2026, 0, 15, 14, 30, 5),
			RECURRING_TYPE.monthly,
			1,
		);
		assert.notEqual(advanced, null);
		assert.equal(advanced?.getHours(), 14);
		assert.equal(advanced?.getMinutes(), 30);
	});

	it("treats a coefficient that cannot mean anything as one step", () => {
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 0)),
			[2026, 3, 11],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, -4)),
			[2026, 3, 11],
		);
		assert.deepEqual(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 2.4)),
			[2026, 3, 12],
		);
	});

	it("has no next occurrence without a cadence", () => {
		assert.equal(nextDate(at(2026, 3, 10), RECURRING_TYPE.none, 1), null);
		assert.equal(nextDate(at(2026, 3, 10), 99, 1), null);
	});
});

describe("cadence unit", () => {
	it("names the unit each cadence steps in", () => {
		assert.equal(cadenceUnit(RECURRING_TYPE.daily), "day");
		assert.equal(cadenceUnit(RECURRING_TYPE.yearly), "year");
	});

	it("falls back to the month for a cadence nothing declares", () => {
		assert.equal(cadenceUnit(RECURRING_TYPE.none), "month");
	});
});

describe("the next landing after today", () => {
	const now = new Date(2026, 2, 20, 10, 30);

	it("walks past the charges that have already settled", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 1, 15), RECURRING_TYPE.monthly, 1, null, now)),
			[2026, 4, 15],
		);
	});

	it("skips a charge landing today — today is not ahead of today", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 1, 20), RECURRING_TYPE.monthly, 1, null, now)),
			[2026, 4, 20],
		);
	});

	// Clamping is lossy on the way through: once February pulls the 31st back to
	// the 28th, every later step walks from the 28th. The back-fill writes the
	// same days, which is the reason the landing is walked and not projected.
	it("keeps the day the walk actually clamped to", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 1, 31), RECURRING_TYPE.monthly, 1, null, now)),
			[2026, 3, 28],
		);
	});

	it("returns a charge still ahead of today rather than stepping past it", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 4, 1), RECURRING_TYPE.monthly, 1, null, now)),
			[2026, 4, 1],
		);
	});

	it("returns a charge ahead of today even on the very next day", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 3, 21), RECURRING_TYPE.monthly, 1, null, now)),
			[2026, 3, 21],
		);
	});

	it("has no landing for a future charge that carries no cadence", () => {
		assert.equal(
			nextLanding(at(2026, 4, 1), RECURRING_TYPE.none, 1, null, now),
			null,
		);
	});

	it("returns a charge ahead of today that lands on the end date itself", () => {
		assert.deepEqual(
			ymd(
				nextLanding(
					at(2026, 4, 1),
					RECURRING_TYPE.monthly,
					1,
					at(2026, 4, 1),
					now,
				),
			),
			[2026, 4, 1],
		);
	});

	it("has no landing when the charge ahead of today is past the end date", () => {
		assert.equal(
			nextLanding(
				at(2026, 4, 1),
				RECURRING_TYPE.monthly,
				1,
				at(2026, 3, 25),
				now,
			),
			null,
		);
	});

	it("stops once the schedule runs past its end date", () => {
		assert.equal(
			nextLanding(
				at(2026, 1, 15),
				RECURRING_TYPE.monthly,
				1,
				at(2026, 4, 1),
				now,
			),
			null,
		);
	});

	it("allows a landing on the end date itself", () => {
		assert.deepEqual(
			ymd(
				nextLanding(
					at(2026, 1, 15),
					RECURRING_TYPE.monthly,
					1,
					at(2026, 4, 15),
					now,
				),
			),
			[2026, 4, 15],
		);
	});

	it("ignores the end date's time of day", () => {
		assert.deepEqual(
			ymd(
				nextLanding(
					at(2026, 1, 15),
					RECURRING_TYPE.monthly,
					1,
					new Date(2026, 3, 15, 1, 0),
					now,
				),
			),
			[2026, 4, 15],
		);
	});

	it("has no landing when the cadence cannot advance", () => {
		assert.equal(
			nextLanding(at(2026, 1, 15), RECURRING_TYPE.none, 1, null, now),
			null,
		);
		assert.equal(nextLanding(at(2026, 1, 15), 99, 1, null, now), null);
	});

	it("walks a weekly cadence the same way", () => {
		assert.deepEqual(
			ymd(nextLanding(at(2026, 3, 1), RECURRING_TYPE.weekly, 1, null, now)),
			[2026, 3, 22],
		);
	});
});
