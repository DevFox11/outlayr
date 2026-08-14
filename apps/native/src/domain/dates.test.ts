import { runtimeLanguage, setRuntimeLanguage } from "@/i18n/runtime";

import * as dates from "./dates";
import {
    formatChargeDate,
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
        expect(startOfWeek(WEDNESDAY).getDate()).toBe(19);
    });

    it("walks back to Monday when the setting says so", () => {
        expect(startOfWeek(WEDNESDAY, 2).getDate()).toBe(20);
    });

    it("stays put when the day already is the first weekday", () => {
        expect(startOfWeek(NOW, 2).getDate()).toBe(27);
    });

    it("returns midnight, not the given wall time", () => {
        expect(startOfWeek(WEDNESDAY).getHours()).toBe(0);
    });
});

describe("month names", () => {
    it("names the month in each language", () => {
        expect(monthAbbrevTitle(WEDNESDAY, "en")).toBe("Jul");
        expect(monthAbbrevTitle(WEDNESDAY, "es")).toBe("jul");
        expect(formatMonthLabel(WEDNESDAY, "en")).toBe("JULY");
        expect(formatMonthLabel(WEDNESDAY, "es")).toBe("JULIO");
    });

    it("shouts the abbreviation without losing the accent", () => {
        expect(monthAbbrev(WEDNESDAY, "en")).toBe("JUL");
        // March abbreviates to "mar" in Spanish, which must survive upper-casing.
        expect(monthAbbrev(new Date("2026-03-04T09:00:00"), "es")).toBe("MAR");
    });

    it("indexes December off the end of the year rather than wrapping", () => {
        const december = new Date("2026-12-01T09:00:00");
        expect(monthAbbrevTitle(december, "en")).toBe("Dec");
        expect(monthAbbrevTitle(december, "es")).toBe("dic");
    });
});

describe("weekdayInitial", () => {
    it("takes the letter the language actually uses", () => {
        expect(weekdayInitial(WEDNESDAY, "en")).toBe("W");
        // Spanish disambiguates miércoles from martes with X, so it cannot be
        // derived by slicing the abbreviation.
        expect(weekdayInitial(WEDNESDAY, "es")).toBe("X");
        expect(weekdayInitial(NOW, "en")).toBe("M");
        expect(weekdayInitial(NOW, "es")).toBe("L");
    });
});

describe("formatDayHeader", () => {
    it("names today and yesterday rather than dating them", () => {
        expect(formatDayHeader(NOW, NOW, "en")).toBe("TODAY");
        expect(formatDayHeader(new Date("2026-07-26T09:00:00"), NOW, "en")).toBe("YESTERDAY");
        expect(formatDayHeader(NOW, NOW, "es")).toBe("HOY");
        expect(formatDayHeader(new Date("2026-07-26T09:00:00"), NOW, "es")).toBe("AYER");
    });

    it("abbreviates the weekday and puts the day before the month", () => {
        expect(formatDayHeader(WEDNESDAY, NOW, "en")).toBe("WED, 22 JUL");
        expect(formatDayHeader(WEDNESDAY, NOW, "es")).toBe("MIÉ, 22 JUL");
    });

    it("adds a shortened year once the day falls before the current one", () => {
        const lastYear = new Date("2025-12-30T09:00:00");
        expect(formatDayHeader(lastYear, NOW, "en")).toBe("TUE, 30 DEC '25");
        expect(formatDayHeader(lastYear, NOW, "es")).toBe("MAR, 30 DIC '25");
    });
});

describe("formatUpcomingDate", () => {
    it("names only the day and month an entry lands on", () => {
        expect(formatUpcomingDate(WEDNESDAY, "en")).toBe("22 JUL");
        expect(formatUpcomingDate(WEDNESDAY, "es")).toBe("22 JUL");
        expect(formatUpcomingDate(new Date("2026-01-09T09:00:00"), "es")).toBe("9 ENE");
    });
});

describe("formatTime", () => {
    const MIDNIGHT = new Date("2026-07-22T00:07:00");
    const NOON = new Date("2026-07-22T12:05:00");
    const AFTERNOON = new Date("2026-07-22T13:04:00");
    const EVENING = new Date("2026-07-22T21:04:00");

    it("keeps midnight and noon on 12 rather than 0", () => {
        expect(formatTime(MIDNIGHT, false, "en")).toBe("12:07 AM");
        expect(formatTime(NOON, false, "en")).toBe("12:05 PM");
    });

    it("drops the leading zero from a 12-hour hour", () => {
        expect(formatTime(AFTERNOON, false, "en")).toBe("1:04 PM");
        expect(formatTime(EVENING, false, "en")).toBe("9:04 PM");
    });

    it("uses the language's own meridiem", () => {
        expect(formatTime(MIDNIGHT, false, "es")).toBe("12:07 a. m.");
        expect(formatTime(EVENING, false, "es")).toBe("9:04 p. m.");
    });

    it("pads the hour and drops the meridiem on a 24-hour clock", () => {
        expect(formatTime(MIDNIGHT, true, "en")).toBe("00:07");
        expect(formatTime(NOON, true, "en")).toBe("12:05");
        expect(formatTime(AFTERNOON, true, "en")).toBe("13:04");
        expect(formatTime(EVENING, true, "en")).toBe("21:04");
    });

    it("renders the same 24-hour string in either language", () => {
        expect(formatTime(EVENING, true, "es")).toBe(formatTime(EVENING, true, "en"));
    });

    it("stays on the 12-hour clock until the setting says otherwise", () => {
        expect(formatTime(EVENING, undefined, "en")).toBe("9:04 PM");
    });
});

describe("the language argument", () => {
    // A hardcoded English fallback is exactly how six duplicate English tables
    // accumulated: every un-migrated call site must still follow the user.
    it("falls back to the live language, never to English", () => {
        underRuntimeLanguage("es", () => {
            expect(monthAbbrevTitle(WEDNESDAY)).toBe("jul");
            expect(monthAbbrev(WEDNESDAY)).toBe("JUL");
            expect(formatMonthLabel(WEDNESDAY)).toBe("JULIO");
            expect(weekdayInitial(WEDNESDAY)).toBe("X");
            expect(formatDayHeader(WEDNESDAY, NOW)).toBe("MIÉ, 22 JUL");
            expect(formatDayHeader(NOW, NOW)).toBe("HOY");
            expect(formatTime(new Date("2026-07-22T21:04:00"))).toBe("9:04 p. m.");
        });
    });

    it("renders English once the runtime language is English again", () => {
        underRuntimeLanguage("en", () => {
            expect(formatDayHeader(WEDNESDAY, NOW)).toBe("WED, 22 JUL");
        });
    });
});

describe("the module surface", () => {
    // The six tables collapsed into the catalog; nothing here may reintroduce a
    // seventh by holding month or weekday names of its own.
    it("exports no date-name table", () => {
        for (const value of Object.values(dates)) {
            expect(Array.isArray(value)).toBe(false);
        }
    });
});

describe("formatChargeDate", () => {
    it("writes the weekday and day in the language's own case", () => {
        expect(formatChargeDate(new Date(2026, 10, 7), NOW, "en")).toBe("Sat, 7 Nov");
        expect(formatChargeDate(new Date(2026, 10, 7), NOW, "es")).toBe("sáb, 7 nov");
    });

    it("adds the year only once the charge leaves the current one", () => {
        expect(formatChargeDate(new Date(2027, 1, 7), NOW, "en")).toBe("Sun, 7 Feb 2027");
    });
});
