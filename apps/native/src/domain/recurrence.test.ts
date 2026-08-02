import {
	cadenceUnit,
	ensureRecurringType,
	nextDate,
	nextLanding,
	RECURRING_TYPE,
} from "./recurrence";

const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

const ymd = (d: Date | null): [number, number, number] | null =>
	d == null ? null : [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("advancing one occurrence", () => {
	it("advances each cadence by its own unit", () => {
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 1)),
		).toStrictEqual([2026, 3, 11]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.weekly, 1)),
		).toStrictEqual([2026, 3, 17]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.monthly, 1)),
		).toStrictEqual([2026, 4, 10]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.yearly, 1)),
		).toStrictEqual([2027, 3, 10]);
	});

	it("multiplies by the coefficient", () => {
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 5)),
		).toStrictEqual([2026, 3, 15]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.weekly, 2)),
		).toStrictEqual([2026, 3, 24]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.monthly, 3)),
		).toStrictEqual([2026, 6, 10]);
	});

	it("clamps a day the target month does not have", () => {
		expect(
			ymd(nextDate(at(2026, 1, 31), RECURRING_TYPE.monthly, 1)),
		).toStrictEqual([2026, 2, 28]);
		expect(
			ymd(nextDate(at(2026, 3, 31), RECURRING_TYPE.monthly, 1)),
		).toStrictEqual([2026, 4, 30]);
		expect(
			ymd(nextDate(at(2024, 2, 29), RECURRING_TYPE.yearly, 1)),
		).toStrictEqual([2025, 2, 28]);
	});

	it("keeps the charge's time of day", () => {
		const advanced = nextDate(
			new Date(2026, 0, 15, 14, 30, 5),
			RECURRING_TYPE.monthly,
			1,
		);
		expect(advanced).not.toBe(null);
		expect(advanced?.getHours()).toBe(14);
		expect(advanced?.getMinutes()).toBe(30);
	});

	it("treats a coefficient that cannot mean anything as one step", () => {
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 0)),
		).toStrictEqual([2026, 3, 11]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, -4)),
		).toStrictEqual([2026, 3, 11]);
		expect(
			ymd(nextDate(at(2026, 3, 10), RECURRING_TYPE.daily, 2.4)),
		).toStrictEqual([2026, 3, 12]);
	});

	it("has no next occurrence without a cadence", () => {
		expect(nextDate(at(2026, 3, 10), RECURRING_TYPE.none, 1)).toBe(null);
		expect(nextDate(at(2026, 3, 10), 99, 1)).toBe(null);
	});
});

describe("cadence unit", () => {
	it("names the unit each cadence steps in", () => {
		expect(cadenceUnit(RECURRING_TYPE.daily)).toBe("day");
		expect(cadenceUnit(RECURRING_TYPE.yearly)).toBe("year");
	});

	it("falls back to the month for a cadence nothing declares", () => {
		expect(cadenceUnit(RECURRING_TYPE.none)).toBe("month");
	});
});

describe("the next landing after today", () => {
	const now = new Date(2026, 2, 20, 10, 30);

	it("walks past the charges that have already settled", () => {
		expect(
			ymd(nextLanding(at(2026, 1, 15), RECURRING_TYPE.monthly, 1, null, now)),
		).toStrictEqual([2026, 4, 15]);
	});

	it("skips a charge landing today — today is not ahead of today", () => {
		expect(
			ymd(nextLanding(at(2026, 1, 20), RECURRING_TYPE.monthly, 1, null, now)),
		).toStrictEqual([2026, 4, 20]);
	});

	// Clamping is lossy on the way through: once February pulls the 31st back to
	// the 28th, every later step walks from the 28th. The back-fill writes the
	// same days, which is the reason the landing is walked and not projected.
	it("keeps the day the walk actually clamped to", () => {
		expect(
			ymd(nextLanding(at(2026, 1, 31), RECURRING_TYPE.monthly, 1, null, now)),
		).toStrictEqual([2026, 3, 28]);
	});

	it("returns a charge still ahead of today rather than stepping past it", () => {
		expect(
			ymd(nextLanding(at(2026, 4, 1), RECURRING_TYPE.monthly, 1, null, now)),
		).toStrictEqual([2026, 4, 1]);
	});

	it("returns a charge ahead of today even on the very next day", () => {
		expect(
			ymd(nextLanding(at(2026, 3, 21), RECURRING_TYPE.monthly, 1, null, now)),
		).toStrictEqual([2026, 3, 21]);
	});

	it("has no landing for a future charge that carries no cadence", () => {
		expect(nextLanding(at(2026, 4, 1), RECURRING_TYPE.none, 1, null, now)).toBe(
			null,
		);
	});

	it("returns a charge ahead of today that lands on the end date itself", () => {
		expect(
			ymd(
				nextLanding(
					at(2026, 4, 1),
					RECURRING_TYPE.monthly,
					1,
					at(2026, 4, 1),
					now,
				),
			),
		).toStrictEqual([2026, 4, 1]);
	});

	it("has no landing when the charge ahead of today is past the end date", () => {
		expect(
			nextLanding(
				at(2026, 4, 1),
				RECURRING_TYPE.monthly,
				1,
				at(2026, 3, 25),
				now,
			),
		).toBe(null);
	});

	it("stops once the schedule runs past its end date", () => {
		expect(
			nextLanding(
				at(2026, 1, 15),
				RECURRING_TYPE.monthly,
				1,
				at(2026, 4, 1),
				now,
			),
		).toBe(null);
	});

	it("allows a landing on the end date itself", () => {
		expect(
			ymd(
				nextLanding(
					at(2026, 1, 15),
					RECURRING_TYPE.monthly,
					1,
					at(2026, 4, 15),
					now,
				),
			),
		).toStrictEqual([2026, 4, 15]);
	});

	it("ignores the end date's time of day", () => {
		expect(
			ymd(
				nextLanding(
					at(2026, 1, 15),
					RECURRING_TYPE.monthly,
					1,
					new Date(2026, 3, 15, 1, 0),
					now,
				),
			),
		).toStrictEqual([2026, 4, 15]);
	});

	it("has no landing when the cadence cannot advance", () => {
		expect(
			nextLanding(at(2026, 1, 15), RECURRING_TYPE.none, 1, null, now),
		).toBe(null);
		expect(nextLanding(at(2026, 1, 15), 99, 1, null, now)).toBe(null);
	});

	it("walks a weekly cadence the same way", () => {
		expect(
			ymd(nextLanding(at(2026, 3, 1), RECURRING_TYPE.weekly, 1, null, now)),
		).toStrictEqual([2026, 3, 22]);
	});
});

describe("ensureRecurringType", () => {
	it("defaults a cadence-less type to monthly", () => {
		expect(ensureRecurringType(RECURRING_TYPE.none)).toBe(
			RECURRING_TYPE.monthly,
		);
	});

	it("leaves an already-set cadence untouched", () => {
		expect(ensureRecurringType(RECURRING_TYPE.weekly)).toBe(
			RECURRING_TYPE.weekly,
		);
		expect(ensureRecurringType(RECURRING_TYPE.yearly)).toBe(
			RECURRING_TYPE.yearly,
		);
	});
});
