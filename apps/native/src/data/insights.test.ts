import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { categories, transactions } from "@/db/schema";
import {
	bucketDateLabel,
	bucketRanges,
	bucketSeries,
	type CategoryMeta,
	categoryBreakdown,
	elapsedSlots,
	type InsightsContribution,
	loadContributions,
	monthPeriodStart,
	offsetForDate,
	periodTotal,
	subcategoryBreakdown,
	windowLabel,
	windowShortLabel,
	windowStart,
	windowTotals,
} from "./insights";

type TestDb = ReturnType<typeof drizzle>;

const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
	new Date(y, m - 1, d, h, min, 0, 0);

// Tuesday, Jul 15 2025 at noon. Windows are calendar-anchored, so with the
// default Sunday-first week: week = Jul 13–19; month = Jul 1–31; year = 2025.
const NOW = at(2025, 7, 15, 12, 0);

function makeDb(): TestDb {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE categories (
			id text PRIMARY KEY NOT NULL,
			name text,
			color text DEFAULT '#FFFFFF',
			icon text,
			emoji text,
			income integer NOT NULL DEFAULT 0,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer,
			parentId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			currency text,
			note text NOT NULL DEFAULT '',
			details text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer,
			categoryId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite);
}

async function seed(db: TestDb): Promise<void> {
	const now = new Date();
	await db.insert(categories).values([
		{
			id: "food",
			name: "Food",
			color: "#EC7A58",
			icon: "Restaurant02",
			income: false,
			sortOrder: 0,
			updatedAt: now,
		},
		{
			id: "groc",
			name: "Groceries",
			color: "#F3BF56",
			icon: "ShoppingBasket03",
			income: false,
			parentId: "food",
			sortOrder: 1,
			updatedAt: now,
		},
		{
			id: "rent",
			name: "Rent",
			color: "#279AF4",
			emoji: "🏠",
			income: false,
			sortOrder: 2,
			updatedAt: now,
		},
		{
			id: "sal",
			name: "Salary",
			color: "#03CD86",
			icon: "Wallet03",
			income: true,
			sortOrder: 0,
			updatedAt: now,
		},
	]);
	const tx = (
		id: string,
		date: Date,
		amount: number,
		income: boolean,
		categoryId: string,
		deletedAt: Date | null = null,
	) => ({
		id,
		amount,
		income,
		note: "",
		date,
		day: date,
		month: date,
		categoryId,
		onceRecurring: false,
		recurringType: 0,
		recurringCoefficient: 1,
		updatedAt: now,
		deletedAt,
	});
	await db.insert(transactions).values([
		tx("e1", at(2025, 7, 1), 10, false, "food"),
		tx("e2", at(2025, 7, 5), 20, false, "groc"),
		tx("e3", at(2025, 7, 10), 100, false, "rent"),
		tx("e4", at(2025, 7, 12), 5, false, "food"),
		tx("e5", at(2025, 7, 15, 9, 0), 30, false, "rent"),
		tx("e6", at(2025, 3, 3), 50, false, "food"),
		tx("e7", at(2024, 9, 20), 7, false, "rent"),
		tx("b1", at(2025, 6, 1), 8, false, "food"),
		tx("i1", at(2025, 7, 3), 500, true, "sal"),
		tx("i2", at(2025, 7, 15, 10, 0), 40, true, "sal"),
		// Soft-deleted — never counted.
		tx("d1", at(2025, 7, 8), 999, false, "food", now),
		// Future relative to NOW (same day, later time) — never counted.
		tx("f2", at(2025, 7, 15, 18, 0), 88, false, "food"),
	]);
}

let contributions: InsightsContribution[];
let categoriesById: Map<string, CategoryMeta>;

before(async () => {
	const db = makeDb();
	await seed(db);
	contributions = await loadContributions(db, NOW);
	const rows = await db.select().from(categories);
	categoriesById = new Map(
		rows.map((c) => [
			c.id,
			{
				id: c.id,
				name: c.name,
				color: c.color,
				icon: c.icon,
				emoji: c.emoji,
				income: c.income,
				parentId: c.parentId,
			},
		]),
	);
});

describe("loadContributions", () => {
	it("excludes soft-deleted and future rows", () => {
		const ids = new Set(
			contributions.map((c) => `${c.amount}:${c.date.getTime()}`),
		);
		// 12 seeded − d1 (deleted) − f2 (future) = 10 contributions.
		assert.equal(contributions.length, 10);
		assert.ok(!ids.has(`999:${at(2025, 7, 8).getTime()}`));
		assert.ok(!ids.has(`88:${at(2025, 7, 15, 18, 0).getTime()}`));
	});

	it("carries the category's parentId for roll-up", () => {
		const groc = contributions.find((c) => c.categoryId === "groc");
		assert.equal(groc?.parentId, "food");
		const rent = contributions.find((c) => c.categoryId === "rent");
		assert.equal(rent?.parentId, null);
	});
});

describe("bucketRanges boundaries", () => {
	it("week is the calendar week containing today", () => {
		const ranges = bucketRanges("week", NOW);
		assert.equal(ranges.length, 7);
		assert.deepEqual(ranges[0].start, at(2025, 7, 13)); // Sunday
		assert.deepEqual(ranges[6].start, at(2025, 7, 19));
		assert.deepEqual(ranges[6].end, at(2025, 7, 20));
	});

	it("week honours a Monday-first calendar", () => {
		const ranges = bucketRanges("week", NOW, 0, {
			firstWeekday: 2,
			firstDayOfMonth: 1,
		});
		assert.deepEqual(ranges[0].start, at(2025, 7, 14));
		assert.deepEqual(ranges[6].start, at(2025, 7, 20));
	});

	it("month is every day of the calendar month, future included", () => {
		const ranges = bucketRanges("month", NOW);
		assert.equal(ranges.length, 31);
		assert.deepEqual(ranges[0].start, at(2025, 7, 1));
		assert.deepEqual(ranges[30].start, at(2025, 7, 31));
	});

	it("month honours a mid-month anchor", () => {
		const ranges = bucketRanges("month", NOW, 0, {
			firstWeekday: 1,
			firstDayOfMonth: 25,
		});
		// Jul 15 has not reached the 25th, so the period is the one that opened
		// on Jun 25 and runs to Jul 24.
		assert.deepEqual(ranges[0].start, at(2025, 6, 25));
		assert.equal(ranges.length, 30);
		assert.deepEqual(ranges[29].start, at(2025, 7, 24));
	});

	it("year is the twelve months of the calendar year", () => {
		const ranges = bucketRanges("year", NOW);
		assert.equal(ranges.length, 12);
		assert.deepEqual(ranges[0].start, at(2025, 1, 1));
		assert.deepEqual(ranges[11].start, at(2025, 12, 1));
	});
});

describe("monthPeriodStart", () => {
	it("is the first of the month by default", () => {
		assert.deepEqual(monthPeriodStart(NOW), at(2025, 7, 1));
	});

	it("rolls back when the anchor has not been reached", () => {
		assert.deepEqual(monthPeriodStart(at(2025, 7, 24), 25), at(2025, 6, 25));
		assert.deepEqual(monthPeriodStart(at(2025, 7, 25), 25), at(2025, 7, 25));
	});
});

describe("elapsedSlots", () => {
	it("counts only slots that have started in the current window", () => {
		assert.equal(elapsedSlots("week", NOW), 3); // Jul 13, 14, 15
		assert.equal(elapsedSlots("month", NOW), 15);
		assert.equal(elapsedSlots("year", NOW), 7); // Jan–Jul
	});

	it("counts every slot of a window already past", () => {
		assert.equal(elapsedSlots("week", NOW, -1), 7);
		assert.equal(elapsedSlots("month", NOW, -1), 30); // June
		assert.equal(elapsedSlots("year", NOW, -1), 12);
	});
});

describe("bucketSeries — spent", () => {
	it("buckets the week and excludes rows outside it", () => {
		const buckets = bucketSeries(contributions, "week", "spent", NOW);
		// Jul 13–19 holds only e5; e3/e4 fall in the previous calendar week.
		assert.equal(periodTotal(buckets), 30);
		assert.equal(buckets[2].value, 30); // Jul 15: e5 only, f2 is future
		assert.equal(buckets[0].value, 0); // Jul 13
		assert.equal(buckets[6].value, 0); // Jul 19, still to come
	});

	it("buckets the month, excluding income, soft-deleted, and future", () => {
		const buckets = bucketSeries(contributions, "month", "spent", NOW);
		assert.equal(periodTotal(buckets), 165);
		assert.equal(buckets[0].value, 10); // Jul 1
		assert.equal(buckets[7].value, 0); // Jul 8 was soft-deleted
		assert.equal(buckets[14].value, 30); // Jul 15: e5 only, f2 is future
		assert.equal(buckets[30].value, 0); // Jul 31 is charted but empty
	});

	it("buckets the year into months", () => {
		const buckets = bucketSeries(contributions, "year", "spent", NOW);
		// 2025 only — e7 (Sep 2024) now belongs to the previous year's window.
		assert.equal(periodTotal(buckets), 223);
		assert.equal(buckets[2].value, 50); // Mar 2025
		assert.equal(buckets[5].value, 8); // Jun 2025
		assert.equal(buckets[6].value, 165); // Jul 2025
	});
});

describe("bucketSeries — income and net", () => {
	it("income counts only inflows", () => {
		const buckets = bucketSeries(contributions, "month", "income", NOW);
		assert.equal(periodTotal(buckets), 540);
		assert.equal(buckets[2].value, 500); // Jul 3
		assert.equal(buckets[14].value, 40); // Jul 15
	});

	it("net signs each flow (income − expense)", () => {
		const buckets = bucketSeries(contributions, "month", "net", NOW);
		assert.equal(periodTotal(buckets), 375); // 540 − 165
		assert.equal(buckets[0].value, -10); // Jul 1 expense
		assert.equal(buckets[2].value, 500); // Jul 3 income
		assert.equal(buckets[14].value, 10); // Jul 15: +40 − 30
	});
});

describe("categoryBreakdown", () => {
	it("rolls subcategories into their parent and sorts desc", () => {
		const rows = categoryBreakdown(
			contributions,
			categoriesById,
			"month",
			"spent",
			NOW,
		);
		assert.equal(rows.length, 2);
		assert.equal(rows[0].id, "rent");
		assert.equal(rows[0].amount, 130);
		assert.equal(rows[1].id, "food");
		assert.equal(rows[1].amount, 35); // 10 (food) + 20 (groc child) + 5 (food)
		assert.ok(Math.abs(rows[0].fraction - 130 / 165) < 1e-9);
		assert.ok(Math.abs(rows[1].fraction - 35 / 165) < 1e-9);
	});

	it("carries an emoji identity, not only an icon one", () => {
		const rows = categoryBreakdown(
			contributions,
			categoriesById,
			"month",
			"spent",
			NOW,
		);
		const rent = rows.find((row) => row.id === "rent");
		assert.equal(rent?.emoji, "🏠");
		assert.equal(rent?.icon, null);
		const food = rows.find((row) => row.id === "food");
		assert.equal(food?.emoji, null);
		assert.equal(food?.icon, "Restaurant02");
	});

	it("income reads only inflow categories", () => {
		const rows = categoryBreakdown(
			contributions,
			categoriesById,
			"month",
			"income",
			NOW,
		);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].id, "sal");
		assert.equal(rows[0].amount, 540);
		assert.equal(rows[0].fraction, 1);
	});

	it("net mirrors the outflow composition", () => {
		const spent = categoryBreakdown(
			contributions,
			categoriesById,
			"month",
			"spent",
			NOW,
		);
		const net = categoryBreakdown(
			contributions,
			categoriesById,
			"month",
			"net",
			NOW,
		);
		assert.deepEqual(
			net.map((r) => [r.id, r.amount]),
			spent.map((r) => [r.id, r.amount]),
		);
	});

	it("resolves top-level display fields from the category map", () => {
		const rows = categoryBreakdown(
			contributions,
			categoriesById,
			"year",
			"spent",
			NOW,
		);
		const food = rows.find((r) => r.id === "food");
		assert.equal(food?.name, "Food");
		assert.equal(food?.color, "#EC7A58");
		assert.equal(food?.icon, "Restaurant02");
	});
});

describe("bucketRanges — window offset", () => {
	it("month offset -1 is the full previous calendar month", () => {
		const june = bucketRanges("month", NOW, -1);
		assert.equal(june.length, 30); // June has 30 days
		assert.deepEqual(june[0].start, at(2025, 6, 1));
		assert.deepEqual(june[29].start, at(2025, 6, 30));
	});

	it("week offset -1 is the previous calendar week", () => {
		const prev = bucketRanges("week", NOW, -1);
		assert.equal(prev.length, 7);
		assert.deepEqual(prev[0].start, at(2025, 7, 6));
		assert.deepEqual(prev[6].start, at(2025, 7, 12));
	});

	it("year offset -1 is the previous calendar year", () => {
		const prev = bucketRanges("year", NOW, -1);
		assert.equal(prev.length, 12);
		assert.deepEqual(prev[0].start, at(2024, 1, 1));
		assert.deepEqual(prev[11].start, at(2024, 12, 1));
	});

	it("windowStart agrees with the first slot", () => {
		assert.deepEqual(windowStart("month", NOW, -2), at(2025, 5, 1));
		assert.deepEqual(windowStart("week", NOW, -2), at(2025, 6, 29));
		assert.deepEqual(windowStart("year", NOW, -3), at(2022, 1, 1));
	});
});

describe("bucketSeries — window offset", () => {
	it("month offset -1 buckets only the previous month's rows", () => {
		const buckets = bucketSeries(contributions, "month", "spent", NOW, -1);
		assert.equal(buckets.length, 30);
		assert.equal(periodTotal(buckets), 8); // b1 (Jun 1)
		assert.equal(buckets[0].value, 8);
	});

	it("week offset -1 buckets the previous calendar week", () => {
		const spent = bucketSeries(contributions, "week", "spent", NOW, -1);
		assert.equal(periodTotal(spent), 105); // e3 (Jul 10) + e4 (Jul 12)
		assert.equal(spent[4].value, 100);
		assert.equal(spent[6].value, 5);
		assert.equal(spent[2].value, 0); // Jul 8 was soft-deleted
	});
});

describe("windowTotals", () => {
	it("splits the current window into income and spent", () => {
		assert.deepEqual(windowTotals(contributions, "month", NOW, 0), {
			income: 540,
			spent: 165,
		});
	});

	it("tracks the offset window", () => {
		assert.deepEqual(windowTotals(contributions, "month", NOW, -1), {
			income: 0,
			spent: 8,
		});
		assert.deepEqual(windowTotals(contributions, "week", NOW, 0), {
			income: 40,
			spent: 30,
		});
		assert.deepEqual(windowTotals(contributions, "week", NOW, -1), {
			income: 0,
			spent: 105,
		});
	});
});

describe("offsetForDate", () => {
	it("maps a date to the offset window containing it", () => {
		assert.equal(offsetForDate("month", at(2025, 7, 15), NOW), 0);
		assert.equal(offsetForDate("month", at(2025, 6, 1), NOW), -1);
		assert.equal(offsetForDate("month", at(2025, 3, 3), NOW), -4);
		assert.equal(offsetForDate("week", at(2025, 7, 15), NOW), 0);
		assert.equal(offsetForDate("week", at(2025, 7, 13), NOW), 0);
		assert.equal(offsetForDate("week", at(2025, 7, 8), NOW), -1);
		assert.equal(offsetForDate("week", at(2025, 7, 1), NOW), -2);
		assert.equal(offsetForDate("year", at(2025, 3, 3), NOW), 0);
		assert.equal(offsetForDate("year", at(2024, 9, 20), NOW), -1);
	});
});

describe("subcategoryBreakdown", () => {
	it("splits a parent into Direct plus children, sorted desc", () => {
		const subs = subcategoryBreakdown(
			contributions,
			categoriesById,
			"food",
			"month",
			"spent",
			NOW,
		);
		assert.equal(subs.length, 2);
		assert.equal(subs[0].id, "groc");
		assert.equal(subs[0].amount, 20);
		assert.equal(subs[1].name, "Direct"); // e1 (10) + e4 (5)
		assert.equal(subs[1].amount, 15);
		assert.ok(Math.abs(subs[0].fraction - 20 / 35) < 1e-9);
	});

	it("returns a single Direct entry for a childless parent", () => {
		const subs = subcategoryBreakdown(
			contributions,
			categoriesById,
			"rent",
			"month",
			"spent",
			NOW,
		);
		assert.equal(subs.length, 1);
		assert.equal(subs[0].name, "Direct");
		assert.equal(subs[0].amount, 130);
		assert.equal(subs[0].fraction, 1);
	});
});

describe("window labels", () => {
	it("formats the headline window label", () => {
		assert.equal(windowLabel("month", 0, NOW), "Jul 2025");
		assert.equal(windowLabel("month", -1, NOW), "Jun 2025");
		assert.equal(windowLabel("year", 0, NOW), "2025");
		assert.equal(windowLabel("week", 0, NOW), "13 - 19 Jul");
		// A week straddling two months names both.
		assert.equal(windowLabel("week", -2, NOW), "29 Jun - 5 Jul");
	});

	it("formats the compact swipe and bucket labels", () => {
		assert.equal(windowShortLabel("week", -1, NOW), "6 Jul");
		assert.equal(windowShortLabel("month", -1, NOW), "Jun 25");
		assert.equal(windowShortLabel("year", -1, NOW), "2024");
		assert.equal(bucketDateLabel("month", at(2025, 7, 12)), "12 Jul 2025");
		assert.equal(bucketDateLabel("year", at(2025, 7, 1)), "Jul 2025");
	});
});
