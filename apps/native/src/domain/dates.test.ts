import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDayHeader, formatUpcomingDate, startOfWeek } from "./dates";

// 2026-07-22 is a Wednesday; 2026-07-27 a Monday.
const WEDNESDAY = new Date("2026-07-22T15:30:00");
const NOW = new Date("2026-07-27T13:00:00");

describe("startOfWeek", () => {
	it("walks back to Sunday by default", () => {
		assert.equal(startOfWeek(WEDNESDAY).getDate(), 19);
	});

	it("walks back to Monday when the setting says so", () => {
		assert.equal(startOfWeek(WEDNESDAY, 2).getDate(), 20);
	});

	it("stays put when the day already is the first weekday", () => {
		assert.equal(startOfWeek(NOW, 2).getDate(), 27);
	});

	it("returns midnight, not the given wall time", () => {
		assert.equal(startOfWeek(WEDNESDAY).getHours(), 0);
	});
});

describe("formatDayHeader", () => {
	it("names today and yesterday rather than dating them", () => {
		assert.equal(formatDayHeader(NOW, NOW), "TODAY");
		assert.equal(
			formatDayHeader(new Date("2026-07-26T09:00:00"), NOW),
			"YESTERDAY",
		);
	});

	it("abbreviates the weekday and puts the day before the month", () => {
		assert.equal(formatDayHeader(WEDNESDAY, NOW), "WED, 22 JUL");
	});

	it("adds a shortened year once the day falls before the current one", () => {
		assert.equal(
			formatDayHeader(new Date("2025-12-30T09:00:00"), NOW),
			"TUE, 30 DEC '25",
		);
	});
});

describe("formatUpcomingDate", () => {
	it("names only the day and month an entry lands on", () => {
		assert.equal(formatUpcomingDate(WEDNESDAY), "22 JUL");
	});
});
