import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runtimeLanguage, setRuntimeLanguage } from "@/i18n/runtime";
import * as dates from "./dates";
import {
	formatDayHeader,
	formatMonthLabel,
	formatTime,
	formatUpcomingDate,
	monthAbbrev,
	monthAbbrevTitle,
	startOfWeek,
	weekdayInitial,
} from "./dates";

// 2026-07-22 is a Wednesday; 2026-07-27 a Monday.
const WEDNESDAY = new Date("2026-07-22T15:30:00");
const NOW = new Date("2026-07-27T13:00:00");

/** The runtime language is process-wide, so no test may leave it moved. */
function underRuntimeLanguage(language: "en" | "es", body: () => void): void {
	const before = runtimeLanguage();
	setRuntimeLanguage(language);
	try {
		body();
	} finally {
		setRuntimeLanguage(before);
	}
}

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

describe("month names", () => {
	it("names the month in each language", () => {
		assert.equal(monthAbbrevTitle(WEDNESDAY, "en"), "Jul");
		assert.equal(monthAbbrevTitle(WEDNESDAY, "es"), "jul");
		assert.equal(formatMonthLabel(WEDNESDAY, "en"), "JULY");
		assert.equal(formatMonthLabel(WEDNESDAY, "es"), "JULIO");
	});

	it("shouts the abbreviation without losing the accent", () => {
		assert.equal(monthAbbrev(WEDNESDAY, "en"), "JUL");
		// March abbreviates to "mar" in Spanish, which must survive upper-casing.
		assert.equal(monthAbbrev(new Date("2026-03-04T09:00:00"), "es"), "MAR");
	});

	it("indexes December off the end of the year rather than wrapping", () => {
		const december = new Date("2026-12-01T09:00:00");
		assert.equal(monthAbbrevTitle(december, "en"), "Dec");
		assert.equal(monthAbbrevTitle(december, "es"), "dic");
	});
});

describe("weekdayInitial", () => {
	it("takes the letter the language actually uses", () => {
		assert.equal(weekdayInitial(WEDNESDAY, "en"), "W");
		// Spanish disambiguates miércoles from martes with X, so it cannot be
		// derived by slicing the abbreviation.
		assert.equal(weekdayInitial(WEDNESDAY, "es"), "X");
		assert.equal(weekdayInitial(NOW, "en"), "M");
		assert.equal(weekdayInitial(NOW, "es"), "L");
	});
});

describe("formatDayHeader", () => {
	it("names today and yesterday rather than dating them", () => {
		assert.equal(formatDayHeader(NOW, NOW, "en"), "TODAY");
		assert.equal(
			formatDayHeader(new Date("2026-07-26T09:00:00"), NOW, "en"),
			"YESTERDAY",
		);
		assert.equal(formatDayHeader(NOW, NOW, "es"), "HOY");
		assert.equal(
			formatDayHeader(new Date("2026-07-26T09:00:00"), NOW, "es"),
			"AYER",
		);
	});

	it("abbreviates the weekday and puts the day before the month", () => {
		assert.equal(formatDayHeader(WEDNESDAY, NOW, "en"), "WED, 22 JUL");
		assert.equal(formatDayHeader(WEDNESDAY, NOW, "es"), "MIÉ, 22 JUL");
	});

	it("adds a shortened year once the day falls before the current one", () => {
		const lastYear = new Date("2025-12-30T09:00:00");
		assert.equal(formatDayHeader(lastYear, NOW, "en"), "TUE, 30 DEC '25");
		assert.equal(formatDayHeader(lastYear, NOW, "es"), "MAR, 30 DIC '25");
	});
});

describe("formatUpcomingDate", () => {
	it("names only the day and month an entry lands on", () => {
		assert.equal(formatUpcomingDate(WEDNESDAY, "en"), "22 JUL");
		assert.equal(formatUpcomingDate(WEDNESDAY, "es"), "22 JUL");
		assert.equal(
			formatUpcomingDate(new Date("2026-01-09T09:00:00"), "es"),
			"9 ENE",
		);
	});
});

describe("formatTime", () => {
	const MIDNIGHT = new Date("2026-07-22T00:07:00");
	const NOON = new Date("2026-07-22T12:05:00");
	const AFTERNOON = new Date("2026-07-22T13:04:00");
	const EVENING = new Date("2026-07-22T21:04:00");

	it("keeps midnight and noon on 12 rather than 0", () => {
		assert.equal(formatTime(MIDNIGHT, false, "en"), "12:07 AM");
		assert.equal(formatTime(NOON, false, "en"), "12:05 PM");
	});

	it("drops the leading zero from a 12-hour hour", () => {
		assert.equal(formatTime(AFTERNOON, false, "en"), "1:04 PM");
		assert.equal(formatTime(EVENING, false, "en"), "9:04 PM");
	});

	it("uses the language's own meridiem", () => {
		assert.equal(formatTime(MIDNIGHT, false, "es"), "12:07 a. m.");
		assert.equal(formatTime(EVENING, false, "es"), "9:04 p. m.");
	});

	it("pads the hour and drops the meridiem on a 24-hour clock", () => {
		assert.equal(formatTime(MIDNIGHT, true, "en"), "00:07");
		assert.equal(formatTime(NOON, true, "en"), "12:05");
		assert.equal(formatTime(AFTERNOON, true, "en"), "13:04");
		assert.equal(formatTime(EVENING, true, "en"), "21:04");
	});

	it("renders the same 24-hour string in either language", () => {
		assert.equal(
			formatTime(EVENING, true, "es"),
			formatTime(EVENING, true, "en"),
		);
	});

	it("stays on the 12-hour clock until the setting says otherwise", () => {
		assert.equal(formatTime(EVENING, undefined, "en"), "9:04 PM");
	});
});

describe("the language argument", () => {
	// A hardcoded English fallback is exactly how six duplicate English tables
	// accumulated: every un-migrated call site must still follow the user.
	it("falls back to the live language, never to English", () => {
		underRuntimeLanguage("es", () => {
			assert.equal(monthAbbrevTitle(WEDNESDAY), "jul");
			assert.equal(monthAbbrev(WEDNESDAY), "JUL");
			assert.equal(formatMonthLabel(WEDNESDAY), "JULIO");
			assert.equal(weekdayInitial(WEDNESDAY), "X");
			assert.equal(formatDayHeader(WEDNESDAY, NOW), "MIÉ, 22 JUL");
			assert.equal(formatDayHeader(NOW, NOW), "HOY");
			assert.equal(formatTime(new Date("2026-07-22T21:04:00")), "9:04 p. m.");
		});
	});

	it("renders English once the runtime language is English again", () => {
		underRuntimeLanguage("en", () => {
			assert.equal(formatDayHeader(WEDNESDAY, NOW), "WED, 22 JUL");
		});
	});
});

describe("the module surface", () => {
	// The six tables collapsed into the catalog; nothing here may reintroduce a
	// seventh by holding month or weekday names of its own.
	it("exports no date-name table", () => {
		for (const value of Object.values(dates)) {
			assert.equal(Array.isArray(value), false);
		}
	});
});
