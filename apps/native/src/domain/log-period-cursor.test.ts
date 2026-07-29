import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canStepForward,
	cursorEnd,
	cursorLabel,
	cursorStart,
	stepCursor,
} from "./log-period-cursor";

// A Wednesday.
const MID_WEEK = new Date("2026-07-22T15:30:00");
const NOW = new Date("2026-07-27T13:00:00");

describe("cursorStart", () => {
	it("normalizes a day to its midnight", () => {
		assert.equal(
			cursorStart("day", MID_WEEK).getTime(),
			new Date("2026-07-22T00:00:00").getTime(),
		);
	});

	it("normalizes a week to the configured first weekday", () => {
		assert.equal(cursorStart("week", MID_WEEK, 1).getDate(), 19); // Sunday
		assert.equal(cursorStart("week", MID_WEEK, 2).getDate(), 20); // Monday
	});

	it("normalizes a month to its first instant", () => {
		assert.equal(cursorStart("month", MID_WEEK).getDate(), 1);
	});
});

describe("cursorEnd", () => {
	it("lands on the first instant after the unit", () => {
		assert.equal(cursorEnd("day", MID_WEEK).getDate(), 23);
		assert.equal(cursorEnd("week", MID_WEEK, 1).getDate(), 26);
		assert.equal(cursorEnd("month", MID_WEEK).getMonth(), 7);
	});
});

describe("stepCursor", () => {
	it("steps by whole units and re-normalizes", () => {
		assert.equal(stepCursor("week", MID_WEEK, -1, 1).getDate(), 12);
		assert.equal(stepCursor("month", MID_WEEK, 1).getMonth(), 7);
	});

	it("keeps a month step on the first even from a late day-of-month", () => {
		const late = new Date("2026-01-31T09:00:00");
		const stepped = stepCursor("month", late, 1);
		assert.equal(stepped.getDate(), 1);
		assert.equal(stepped.getMonth(), 1);
	});
});

describe("canStepForward", () => {
	it("refuses a step that would land in the future", () => {
		// The week containing "now" — stepping forward leaves the present behind.
		assert.equal(canStepForward("week", NOW, NOW, 1), false);
		assert.equal(canStepForward("week", MID_WEEK, NOW, 1), true);
	});
});

describe("cursorLabel", () => {
	it("labels a day with its full date", () => {
		assert.equal(cursorLabel("day", MID_WEEK), "22 Jul 2026");
	});

	it("labels a month without a day", () => {
		assert.equal(cursorLabel("month", MID_WEEK), "Jul 2026");
	});

	it("labels a week as the span it covers", () => {
		assert.equal(cursorLabel("week", MID_WEEK, 1), "19 Jul – 25 Jul");
	});

	it("names both months when a week straddles them", () => {
		assert.equal(
			cursorLabel("week", new Date("2026-07-29T09:00:00"), 1),
			"26 Jul – 1 Aug",
		);
	});
});
