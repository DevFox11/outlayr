import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { transactions } from "@/db/schema";
import { logWindowDaysQuery, logWindowRowsQuery } from "./transactions-core";

type TestDb = ReturnType<typeof drizzle>;

const at = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min, 0, 0);

const NOW = at(2025, 7, 15, 23).getTime();

function makeDb(): TestDb {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
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
			recurringAnchorDay integer,
			reminderLeadDays integer,
			categoryId text,
			accountId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite);
}

/**
 * `count` rows all dated on day `d` of July 2025. Spread by the minute, not the
 * hour: past 24 rows an hourly offset rolls into the next day, which leaves
 * `day` on the seeded date while `date` says otherwise.
 */
async function seedDay(db: TestDb, d: number, count: number): Promise<void> {
	const day = at(2025, 7, d);
	await db.insert(transactions).values(
		Array.from({ length: count }, (_, i) => ({
			amount: 1,
			date: at(2025, 7, d, 0, i),
			day,
			id: `jul${d}-${i}`,
			income: false,
			month: at(2025, 7, 1),
			note: `jul${d}-${i}`,
			updatedAt: new Date(0),
		}))
	);
}

async function windowFor(db: TestDb, days: number) {
	const dayRows = await logWindowDaysQuery(db, NOW, days);
	const floorMs = dayRows.at(-1)?.day?.getTime() ?? null;
	const rows = await logWindowRowsQuery(db, NOW, floorMs);
	return { dayRows, reachedEnd: dayRows.length < days, rows };
}

describe("log window", () => {
	it("returns every row of every day it includes, never a partial day", async () => {
		const db = makeDb();
		// Day 14 holds far more rows than the other two, so a row-based LIMIT
		// would cut it — and the Log prints a per-day subtotal off these rows.
		await seedDay(db, 15, 2);
		await seedDay(db, 14, 9);
		await seedDay(db, 13, 3);

		const { rows } = await windowFor(db, 2);

		expect(rows.length).toBe(11);
		expect(rows.filter((r) => r.day.getDate() === 14).length).toBe(9);
		expect(rows.filter((r) => r.day.getDate() === 13).length).toBe(0);
	});

	it("projects the identity a row stores, so the list can paint it", async () => {
		const db = makeDb();
		const day = at(2025, 7, 15);
		await db.insert(transactions).values({
			amount: 1,
			customColor: "#FF0000",
			date: day,
			day,
			emoji: "🍕",
			icon: "Coffee02",
			id: "identity",
			imageColor: "#00FF00",
			income: false,
			month: at(2025, 7, 1),
			note: "Lunch",
			updatedAt: new Date(0),
		});

		const { rows } = await windowFor(db, 1);

		expect({
			customColor: rows[0]?.customColor,
			emoji: rows[0]?.emoji,
			icon: rows[0]?.icon,
			imageColor: rows[0]?.imageColor,
		}).toStrictEqual({
			customColor: "#FF0000",
			emoji: "🍕",
			icon: "Coffee02",
			imageColor: "#00FF00",
		});
	});

	it("widens by whole days and keeps the rows it already had", async () => {
		const db = makeDb();
		await seedDay(db, 15, 2);
		await seedDay(db, 14, 9);
		await seedDay(db, 13, 3);

		const first = await windowFor(db, 2);
		const second = await windowFor(db, 3);

		expect(second.rows.length).toBe(14);
		const kept = new Set(second.rows.map((r) => r.id));
		for (const row of first.rows) {
			expect(kept.has(row.id)).toBeTruthy();
		}
	});

	it("reports the end only once no older day remains", async () => {
		const db = makeDb();
		await seedDay(db, 15, 1);
		await seedDay(db, 14, 1);

		expect((await windowFor(db, 1)).reachedEnd).toBe(false);
		expect((await windowFor(db, 2)).reachedEnd).toBe(false);
		expect((await windowFor(db, 3)).reachedEnd).toBe(true);
	});

	it("counts days, not rows, so one busy day cannot fill the window", async () => {
		const db = makeDb();
		await seedDay(db, 15, 40);
		await seedDay(db, 14, 1);

		const { dayRows, rows } = await windowFor(db, 2);

		expect(dayRows.length).toBe(2);
		expect(rows.length).toBe(41);
	});

	it("excludes deleted and future rows from the window it measures", async () => {
		const db = makeDb();
		await seedDay(db, 15, 1);
		await seedDay(db, 14, 1);
		await db.insert(transactions).values([
			{
				amount: 1,
				date: at(2025, 7, 13),
				day: at(2025, 7, 13),
				deletedAt: new Date(0),
				id: "deleted",
				income: false,
				month: at(2025, 7, 1),
				note: "deleted",
				updatedAt: new Date(0),
			},
			{
				amount: 1,
				date: at(2025, 7, 20),
				day: at(2025, 7, 20),
				id: "future",
				income: false,
				month: at(2025, 7, 1),
				note: "future",
				updatedAt: new Date(0),
			},
		]);

		const { dayRows, rows, reachedEnd } = await windowFor(db, 5);

		expect(dayRows.map((r) => r.day.getDate())).toStrictEqual([15, 14]);
		expect(rows.length).toBe(2);
		expect(reachedEnd).toBe(true);
	});

	it("returns nothing at all when no row is visible", async () => {
		const db = makeDb();
		const { dayRows, rows, reachedEnd } = await windowFor(db, 30);

		expect(dayRows.length).toBe(0);
		expect(rows.length).toBe(0);
		expect(reachedEnd).toBe(true);
	});
});
