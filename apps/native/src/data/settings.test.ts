import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
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
		assert.equal(await readBoolSetting(db, "showCents"), true);
		assert.equal(await readBoolSetting(db, "showExpenseOrIncomeSign"), true);
		assert.equal(await readNumberSetting(db, "firstWeekday"), 1);
		assert.equal(await readNumberSetting(db, "firstDayOfMonth"), 1);
	});

	it("keeps the celebration off until it is asked for", async () => {
		assert.equal(await readBoolSetting(db, "confetti"), false);
		await setBoolSetting(db, "confetti", true);
		assert.equal(await readBoolSetting(db, "confetti"), true);
	});

	it("keeps the subscription notices off until they are asked for", async () => {
		assert.equal(await readBoolSetting(db, "subscriptionReminders"), false);
		await setBoolSetting(db, "subscriptionReminders", true);
		assert.equal(await readBoolSetting(db, "subscriptionReminders"), true);
	});

	it("lists the budgets as rows until the grid is asked for", async () => {
		// Inverted against Swift's `budgetViewStyle`, which defaulted to the grid:
		// rows are the shipped budget list here, so the default must not flip it.
		assert.equal(await readBoolSetting(db, "budgetViewStyle"), true);
		await setBoolSetting(db, "budgetViewStyle", false);
		assert.equal(await readBoolSetting(db, "budgetViewStyle"), false);
	});
});

describe("the 12/24-hour clock", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("reads as a 12-hour clock before anything is stored", async () => {
		assert.equal(await readBoolSetting(db, "use24HourClock"), false);
	});

	it("persists and reads back the user's own choice", async () => {
		await setBoolSetting(db, "use24HourClock", true);
		assert.equal(await readBoolSetting(db, "use24HourClock"), true);
		await setBoolSetting(db, "use24HourClock", false);
		assert.equal(await readBoolSetting(db, "use24HourClock"), false);
	});

	it("seeds the device's convention when the user has never chosen", async () => {
		await seedClockPreference(db, true);
		assert.equal(await readBoolSetting(db, "use24HourClock"), true);
	});

	// The whole reason the seed reads the raw row: a stored `false` is a choice,
	// and is indistinguishable from the default through `readBoolSetting`.
	it("never overrules a stored choice, not even a stored false", async () => {
		await setBoolSetting(db, "use24HourClock", false);
		await seedClockPreference(db, true);
		assert.equal(await readBoolSetting(db, "use24HourClock"), false);
	});

	it("does not re-seed once it has seeded", async () => {
		await seedClockPreference(db, true);
		await setBoolSetting(db, "use24HourClock", false);
		await seedClockPreference(db, true);
		assert.equal(await readBoolSetting(db, "use24HourClock"), false);
	});

	it("labels both clocks", () => {
		assert.equal(clockLabel(false), "clock.twelveHour");
		assert.equal(clockLabel(true), "clock.twentyFourHour");
	});
});

describe("settings read/write round-trip", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("persists and reads back a boolean setting", async () => {
		await setBoolSetting(db, "showCents", false);
		assert.equal(await readBoolSetting(db, "showCents"), false);
		await setBoolSetting(db, "showCents", true);
		assert.equal(await readBoolSetting(db, "showCents"), true);
	});

	it("persists and reads back integer settings", async () => {
		await setNumberSetting(db, "firstWeekday", 2);
		await setNumberSetting(db, "firstDayOfMonth", 15);
		assert.equal(await readNumberSetting(db, "firstWeekday"), 2);
		assert.equal(await readNumberSetting(db, "firstDayOfMonth"), 15);
	});

	it("upserts (a second write replaces the first)", async () => {
		await setNumberSetting(db, "firstWeekday", 2);
		await setNumberSetting(db, "firstWeekday", 1);
		assert.equal(await readNumberSetting(db, "firstWeekday"), 1);
	});

	// The permission-revoke reconcile writes `showNotifications` back off, so a
	// shared key would silently disarm every subscription notice with it.
	it("holds the subscription notices on a key of their own", async () => {
		await setBoolSetting(db, "subscriptionReminders", true);
		await setBoolSetting(db, "showNotifications", false);
		assert.equal(await readBoolSetting(db, "subscriptionReminders"), true);
		assert.equal(await readBoolSetting(db, "showNotifications"), false);
	});

	it("writes the global currency under the shared meta key", async () => {
		await setCurrency(db, "EUR");
		assert.equal(await getMeta(db, "currency"), "EUR");
	});
});

describe("setting parsers", () => {
	it("falls back on absence and bad input", () => {
		assert.equal(parseBoolSetting(null, true), true);
		assert.equal(parseBoolSetting("false", true), false);
		assert.equal(parseBoolSetting("true", false), true);
		assert.equal(parseIntSetting(null, 1), 1);
		assert.equal(parseIntSetting("abc", 1), 1);
		assert.equal(parseIntSetting("15", 1), 15);
	});
});

describe("time-frame labels", () => {
	it("labels the weekday setting", () => {
		assert.equal(weekdayLabel(1), "settings.time.sunday");
		assert.equal(weekdayLabel(2), "settings.time.monday");
	});

	it("renders English ordinals", () => {
		assert.equal(ordinalDay(1), "1st");
		assert.equal(ordinalDay(2), "2nd");
		assert.equal(ordinalDay(3), "3rd");
		assert.equal(ordinalDay(4), "4th");
		assert.equal(ordinalDay(11), "11th");
		assert.equal(ordinalDay(12), "12th");
		assert.equal(ordinalDay(13), "13th");
		assert.equal(ordinalDay(21), "21st");
		assert.equal(ordinalDay(22), "22nd");
		assert.equal(ordinalDay(23), "23rd");
	});
});

describe("showCents effect on formatting", () => {
	it("keeps cents when showCents is true (the default)", () => {
		const parts = amountParts(12.34, "USD", true);
		assert.equal(parts.integer, "12");
		assert.equal(parts.fraction, "34");
		assert.equal(formatAmount(12.34, "USD", true), "$12.34");
		// Omitting the flag defaults to showing cents.
		assert.equal(formatAmount(12.34, "USD"), "$12.34");
	});

	it("drops cents and rounds to whole units when showCents is false", () => {
		const parts = amountParts(12.34, "USD", false);
		assert.equal(parts.fraction, "");
		assert.equal(parts.integer, "12");
		assert.equal(formatAmount(12.34, "USD", false), "$12");
		assert.equal(formatAmount(1999.5, "USD", false), "$2,000");
	});

	it("never adds cents to a zero-minor-unit currency", () => {
		assert.equal(amountParts(1234, "JPY", true).fraction, "");
		assert.equal(amountParts(1234, "JPY", true).integer, "1,234");
	});
});
