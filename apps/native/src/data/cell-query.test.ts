import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { transactions } from "@/db/schema";
import { cellFigures } from "@/domain/currency-totals";
import { buildRateTable } from "@/domain/valuation";
import type { SpendDb } from "./budget-spent";
import { logCellQuery, toCurrencyCells } from "./cell-query";

function makeDb() {
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
			reminderLeadDays integer,
			categoryId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as SpendDb;
}

const NOW = new Date(Date.UTC(2026, 6, 31, 23));
const eurRates = buildRateTable([
	{ quote: "EUR", date: "2026-07-01", rate: 0.9 },
	{ quote: "EUR", date: "2026-07-10", rate: 0.95 },
]);

let seq = 0;
async function add(
	db: SpendDb,
	row: {
		amount: number;
		currency: string | null;
		amountUsd: number | null;
		date: Date;
		income?: boolean;
	},
): Promise<void> {
	seq += 1;
	await db.insert(transactions).values({
		id: `t${seq}`,
		amount: row.amount,
		income: row.income ?? false,
		currency: row.currency,
		date: row.date,
		day: row.date,
		month: row.date,
		amountUsd: row.amountUsd,
		updatedAt: NOW,
	});
}

async function figures(db: SpendDb, globalCurrency: string) {
	const rows = await logCellQuery(db, null, NOW);
	return cellFigures(toCurrencyCells(rows), globalCurrency, eurRates);
}

describe("logCellQuery", () => {
	it("keys each group by the row's UTC day, matching what JS derives", async () => {
		const db = makeDb();
		// 23:00 UTC on the 5th and 01:00 UTC on the 6th are the same local day in
		// much of the world and different UTC days. The rate lookup uses UTC, so the
		// grouping must too or the two paths disagree about which rate applies.
		await add(db, {
			amount: 10,
			currency: "USD",
			amountUsd: 10,
			date: new Date(Date.UTC(2026, 6, 5, 23)),
		});
		await add(db, {
			amount: 10,
			currency: "USD",
			amountUsd: 10,
			date: new Date(Date.UTC(2026, 6, 6, 1)),
		});
		const rows = await logCellQuery(db, null, NOW);
		expect(rows.map((row) => row.dateKey).sort()).toStrictEqual([
			"2026-07-05",
			"2026-07-06",
		]);
	});

	it("splits a group's canonicalized and uncanonicalized halves", async () => {
		const db = makeDb();
		await add(db, {
			amount: 100,
			currency: "USD",
			amountUsd: 100,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		await add(db, {
			amount: 40,
			currency: "USD",
			amountUsd: null,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		const rows = await logCellQuery(db, null, NOW);
		expect(rows.length).toBe(1);
		const [cell] = toCurrencyCells(rows);
		expect(cell.amount).toBe(140);
		expect(cell.amountUsd).toBe(100);
		expect(cell.unconvertedAmount).toBe(40);
		expect(cell.count).toBe(2);
		expect(cell.unconvertedCount).toBe(1);
	});

	it("values each day at its own rate across a period", async () => {
		const db = makeDb();
		await add(db, {
			amount: 100,
			currency: "USD",
			amountUsd: 100,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		await add(db, {
			amount: 100,
			currency: "USD",
			amountUsd: 100,
			date: new Date(Date.UTC(2026, 6, 20, 12)),
		});
		// 90 + 95, not 200 at either single rate.
		expect(await figures(db, "EUR")).toStrictEqual([
			{ currencyCode: "EUR", income: 0, expense: 185, count: 2 },
		]);
	});

	it("keeps income and expense apart inside a converted currency", async () => {
		const db = makeDb();
		const july5 = new Date(Date.UTC(2026, 6, 5, 12));
		await add(db, {
			amount: 100,
			currency: "USD",
			amountUsd: 100,
			date: july5,
		});
		await add(db, {
			amount: 200,
			currency: "USD",
			amountUsd: 200,
			date: july5,
			income: true,
		});
		expect(await figures(db, "EUR")).toStrictEqual([
			{ currencyCode: "EUR", income: 180, expense: 90, count: 2 },
		]);
	});

	it("leaves what it cannot convert in its own currency", async () => {
		const db = makeDb();
		await add(db, {
			amount: 60,
			currency: "EUR",
			amountUsd: 66.67,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		await add(db, {
			amount: 25,
			currency: "GBP",
			amountUsd: null,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		expect(await figures(db, "EUR")).toStrictEqual([
			{ currencyCode: "EUR", income: 0, expense: 60, count: 1 },
			{ currencyCode: "GBP", income: 0, expense: 25, count: 1 },
		]);
	});

	it("skips deleted rows", async () => {
		const db = makeDb();
		await add(db, {
			amount: 100,
			currency: "EUR",
			amountUsd: 111,
			date: new Date(Date.UTC(2026, 6, 5, 12)),
		});
		await db.update(transactions).set({ deletedAt: NOW });
		expect(await figures(db, "EUR")).toStrictEqual([
			{ currencyCode: "EUR", income: 0, expense: 0, count: 0 },
		]);
	});
});
