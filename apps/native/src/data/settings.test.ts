import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { amountParts, formatAmount } from "@/domain/money";

import { getMeta } from "./app-meta-core";
import {
    clockLabel,
    ordinalDay,
    parseBoolSetting,
    parseIntSetting,
    readBoolSetting,
    readNumberSetting,
    seedClockPreference,
    setBoolSetting,
    setCurrency,
    setNumberSetting,
    weekdayLabel,
} from "./settings-core";

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
	`);
    return drizzle(sqlite) as unknown as Database;
}

describe("settings defaults", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("returns the faithful defaults on a fresh store", async () => {
        expect(await readBoolSetting(db, "showCents")).toBe(true);
        expect(await readNumberSetting(db, "firstWeekday")).toBe(1);
        expect(await readNumberSetting(db, "firstDayOfMonth")).toBe(1);
    });

    it("keeps the celebration off until it is asked for", async () => {
        expect(await readBoolSetting(db, "confetti")).toBe(false);
        await setBoolSetting(db, "confetti", true);
        expect(await readBoolSetting(db, "confetti")).toBe(true);
    });

    it("keeps the subscription notices off until they are asked for", async () => {
        expect(await readBoolSetting(db, "subscriptionReminders")).toBe(false);
        await setBoolSetting(db, "subscriptionReminders", true);
        expect(await readBoolSetting(db, "subscriptionReminders")).toBe(true);
    });

    it("lists the budgets as rows until the grid is asked for", async () => {
        // Inverted against Swift's `budgetViewStyle`, which defaulted to the grid:
        // rows are the shipped budget list here, so the default must not flip it.
        expect(await readBoolSetting(db, "budgetViewStyle")).toBe(true);
        await setBoolSetting(db, "budgetViewStyle", false);
        expect(await readBoolSetting(db, "budgetViewStyle")).toBe(false);
    });

    it("defaults grounded-lookup consent on for a device that never wrote it", async () => {
        expect(await readBoolSetting(db, "groundedLookup")).toBe(true);
        await setBoolSetting(db, "groundedLookup", false);
        expect(await readBoolSetting(db, "groundedLookup")).toBe(false);
    });
});

describe("the 12/24-hour clock", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("reads as a 12-hour clock before anything is stored", async () => {
        expect(await readBoolSetting(db, "use24HourClock")).toBe(false);
    });

    it("persists and reads back the user's own choice", async () => {
        await setBoolSetting(db, "use24HourClock", true);
        expect(await readBoolSetting(db, "use24HourClock")).toBe(true);
        await setBoolSetting(db, "use24HourClock", false);
        expect(await readBoolSetting(db, "use24HourClock")).toBe(false);
    });

    it("seeds the device's convention when the user has never chosen", async () => {
        await seedClockPreference(db, true);
        expect(await readBoolSetting(db, "use24HourClock")).toBe(true);
    });

    // The whole reason the seed reads the raw row: a stored `false` is a choice,
    // and is indistinguishable from the default through `readBoolSetting`.
    it("never overrules a stored choice, not even a stored false", async () => {
        await setBoolSetting(db, "use24HourClock", false);
        await seedClockPreference(db, true);
        expect(await readBoolSetting(db, "use24HourClock")).toBe(false);
    });

    it("does not re-seed once it has seeded", async () => {
        await seedClockPreference(db, true);
        await setBoolSetting(db, "use24HourClock", false);
        await seedClockPreference(db, true);
        expect(await readBoolSetting(db, "use24HourClock")).toBe(false);
    });

    it("labels both clocks", () => {
        expect(clockLabel(false)).toBe("clock.twelveHour");
        expect(clockLabel(true)).toBe("clock.twentyFourHour");
    });
});

describe("settings read/write round-trip", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("persists and reads back a boolean setting", async () => {
        await setBoolSetting(db, "showCents", false);
        expect(await readBoolSetting(db, "showCents")).toBe(false);
        await setBoolSetting(db, "showCents", true);
        expect(await readBoolSetting(db, "showCents")).toBe(true);
    });

    it("persists and reads back integer settings", async () => {
        await setNumberSetting(db, "firstWeekday", 2);
        await setNumberSetting(db, "firstDayOfMonth", 15);
        expect(await readNumberSetting(db, "firstWeekday")).toBe(2);
        expect(await readNumberSetting(db, "firstDayOfMonth")).toBe(15);
    });

    it("upserts (a second write replaces the first)", async () => {
        await setNumberSetting(db, "firstWeekday", 2);
        await setNumberSetting(db, "firstWeekday", 1);
        expect(await readNumberSetting(db, "firstWeekday")).toBe(1);
    });

    // The permission-revoke reconcile writes `showNotifications` back off, so a
    // shared key would silently disarm every subscription notice with it.
    it("holds the subscription notices on a key of their own", async () => {
        await setBoolSetting(db, "subscriptionReminders", true);
        await setBoolSetting(db, "showNotifications", false);
        expect(await readBoolSetting(db, "subscriptionReminders")).toBe(true);
        expect(await readBoolSetting(db, "showNotifications")).toBe(false);
    });

    it("writes the global currency under the shared meta key", async () => {
        await setCurrency(db, "EUR");
        expect(await getMeta(db, "currency")).toBe("EUR");
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
    it("labels the weekday setting", () => {
        expect(weekdayLabel(1)).toBe("settings.time.sunday");
        expect(weekdayLabel(2)).toBe("settings.time.monday");
    });

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
