import { beforeEach, describe, expect, it } from "@jest/globals";

import type { Database } from "@/db/client";
import { migratedDatabase } from "@/db/test-database";
import { amountParts, formatAmount } from "@/domain/money";

import {
    ordinalDay,
    parseBoolSetting,
    parseIntSetting,
    readBoolSetting,
    readNumberSetting,
    seedClockPreference,
    setBoolSetting,
    setNumberSetting,
} from "./settings-core";

const makeDb = migratedDatabase;

describe("the 12/24-hour clock", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("seeds the device's convention when the user has never chosen", async () => {
        await seedClockPreference(db, true);
        await expect(readBoolSetting(db, "use24HourClock")).resolves.toBe(true);
    });

    // The whole reason the seed reads the raw row: a stored `false` is a choice,
    // and is indistinguishable from the default through `readBoolSetting`.
    it("never overrules a stored choice, not even a stored false", async () => {
        await setBoolSetting(db, "use24HourClock", false);
        await seedClockPreference(db, true);
        await expect(readBoolSetting(db, "use24HourClock")).resolves.toBe(false);
    });

    it("does not re-seed once it has seeded", async () => {
        await seedClockPreference(db, true);
        await setBoolSetting(db, "use24HourClock", false);
        await seedClockPreference(db, true);
        await expect(readBoolSetting(db, "use24HourClock")).resolves.toBe(false);
    });
});

describe("settings read/write round-trip", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("persists and reads back integer settings", async () => {
        await setNumberSetting(db, "firstWeekday", 2);
        await setNumberSetting(db, "firstDayOfMonth", 15);
        await expect(readNumberSetting(db, "firstWeekday")).resolves.toBe(2);
        await expect(readNumberSetting(db, "firstDayOfMonth")).resolves.toBe(15);
    });

    it("upserts (a second write replaces the first)", async () => {
        await setNumberSetting(db, "firstWeekday", 2);
        await setNumberSetting(db, "firstWeekday", 1);
        await expect(readNumberSetting(db, "firstWeekday")).resolves.toBe(1);
    });

    // The permission-revoke reconcile writes `showNotifications` back off, so a
    // shared key would silently disarm every subscription notice with it.
    it("holds the subscription notices on a key of their own", async () => {
        await setBoolSetting(db, "subscriptionReminders", true);
        await setBoolSetting(db, "showNotifications", false);
        await expect(readBoolSetting(db, "subscriptionReminders")).resolves.toBe(true);
        await expect(readBoolSetting(db, "showNotifications")).resolves.toBe(false);
    });
});

describe("setting parsers", () => {
    it("falls back on absence and bad input", () => {
        expect(parseBoolSetting(null, true)).toBe(true);
        expect(parseBoolSetting("false", true)).toBe(false);
        expect(parseBoolSetting("true", false)).toBe(true);
        expect(parseIntSetting(null, 1)).toBe(1);
        expect(parseIntSetting("abc", 1)).toBe(1);
        expect(parseIntSetting("15", 1)).toBe(15);
    });
});

describe("time-frame labels", () => {
    it("renders English ordinals", () => {
        expect(ordinalDay(1)).toBe("1st");
        expect(ordinalDay(2)).toBe("2nd");
        expect(ordinalDay(3)).toBe("3rd");
        expect(ordinalDay(4)).toBe("4th");
        expect(ordinalDay(11)).toBe("11th");
        expect(ordinalDay(12)).toBe("12th");
        expect(ordinalDay(13)).toBe("13th");
        expect(ordinalDay(21)).toBe("21st");
        expect(ordinalDay(22)).toBe("22nd");
        expect(ordinalDay(23)).toBe("23rd");
    });
});

describe("showCents effect on formatting", () => {
    it("keeps cents when showCents is true (the default)", () => {
        const parts = amountParts(12.34, "USD", true);
        expect(parts.integer).toBe("12");
        expect(parts.fraction).toBe("34");
        expect(formatAmount(12.34, "USD", true)).toBe("$12.34");
        // Omitting the flag defaults to showing cents.
        expect(formatAmount(12.34, "USD")).toBe("$12.34");
    });

    it("drops cents and rounds to whole units when showCents is false", () => {
        const parts = amountParts(12.34, "USD", false);
        expect(parts.fraction).toBe("");
        expect(parts.integer).toBe("12");
        expect(formatAmount(12.34, "USD", false)).toBe("$12");
        expect(formatAmount(1999.5, "USD", false)).toBe("$2,000");
    });

    it("never adds cents to a zero-minor-unit currency", () => {
        expect(amountParts(1234, "JPY", true).fraction).toBe("");
        expect(amountParts(1234, "JPY", true).integer).toBe("1,234");
    });
});
