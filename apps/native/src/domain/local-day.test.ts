import { describe, expect, it } from "@jest/globals";

import { addLocalMonths, daysBetween, onUtcPickerDay, startOfLocalDay, tomorrowLocal, utcPickerDay } from "./local-day";

describe("the reader's calendar", () => {
    it("floors to the local midnight, not the epoch's", () => {
        const afternoon = new Date(2026, 7, 21, 15, 30);
        expect(startOfLocalDay(afternoon.getTime())).toBe(new Date(2026, 7, 21).getTime());
    });

    it("counts whole days across a clock change", () => {
        // 47 or 49 hours in a shifting zone; two calendar days either way.
        const from = new Date(2027, 2, 7).getTime();
        const to = new Date(2027, 2, 9).getTime();
        expect(daysBetween(from, to)).toBe(2);
    });

    it("offers tomorrow at midnight, whatever the hour now", () => {
        const late = new Date(2026, 7, 21, 23, 59).getTime();
        expect(tomorrowLocal(late)).toStrictEqual(new Date(2026, 7, 22));
    });

    it("clamps a month offset to the destination month's last day", () => {
        // 31 August plus six months is not 3 March, which is a month further on
        // than the offer said.
        const endOfAugust = new Date(2026, 7, 31).getTime();
        expect(addLocalMonths(endOfAugust, 6)).toStrictEqual(new Date(2027, 1, 28));
    });

    it("keeps the day of the month where the destination has one", () => {
        expect(addLocalMonths(new Date(2026, 7, 15).getTime(), 6)).toStrictEqual(new Date(2027, 1, 15));
    });
});

describe("the Material date picker's UTC days", () => {
    it("opens on the entry's own local day, late in the evening too", () => {
        expect(utcPickerDay(new Date(2026, 9, 14, 23, 30))).toBe("2026-10-14T00:00:00.000Z");
    });

    it("moves to the picked day and keeps the time of day", () => {
        const entry = new Date(2026, 9, 14, 21, 45);
        const moved = onUtcPickerDay(new Date("2026-10-02T00:00:00.000Z"), entry);
        expect(moved).toStrictEqual(new Date(2026, 9, 2, 21, 45));
    });

    it("reads back the day it was opened on as no change", () => {
        const entry = new Date(2026, 9, 14, 23, 30);
        expect(onUtcPickerDay(new Date(utcPickerDay(entry)), entry)).toStrictEqual(entry);
    });
});
