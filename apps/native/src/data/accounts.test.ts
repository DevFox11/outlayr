import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { accountsCellQuery, toCurrencyCell } from "./cell-query";

function makeDb(): Database {
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
	return drizzle(sqlite) as unknown as Database;
}

const JUNE_1 = new Date("2026-06-01T12:00:00.000Z");

async function addTransaction(
	db: Database,
	overrides: Partial<typeof transactions.$inferInsert> & { id: string }
): Promise<void> {
	await db.insert(transactions).values({
		amount: 10,
		amountUsd: 10,
		currency: "USD",
		date: JUNE_1,
		day: JUNE_1,
		income: false,
		month: JUNE_1,
		note: "",
		updatedAt: JUNE_1,
		...overrides,
	});
}

describe("accountsCellQuery", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("groups attached rows by account, currency, direction and day", async () => {
		await addTransaction(db, { accountId: "a1", amount: 5, id: "t1" });
		await addTransaction(db, { accountId: "a1", amount: 7, id: "t2" });
		await addTransaction(db, {
			accountId: "a1",
			amount: 3,
			id: "t3",
			income: true,
		});
		await addTransaction(db, { accountId: "a2", amount: 11, id: "t4" });

		const rows = await accountsCellQuery(db);
		const byKey = rows.map((row) => ({
			accountId: row.accountId,
			...toCurrencyCell(row),
		}));

		const a1Expense = byKey.find((cell) => cell.accountId === "a1" && !cell.income);
		expect(a1Expense?.amount).toBe(12);
		expect(a1Expense?.count).toBe(2);
		const a1Income = byKey.find((cell) => cell.accountId === "a1" && cell.income);
		expect(a1Income?.amount).toBe(3);
		expect(byKey.find((cell) => cell.accountId === "a2")?.amount).toBe(11);
	});

	it("excludes detached and soft-deleted rows", async () => {
		await addTransaction(db, { accountId: null, amount: 99, id: "t1" });
		await addTransaction(db, {
			accountId: "a1",
			amount: 5,
			deletedAt: JUNE_1,
			id: "t2",
		});
		await addTransaction(db, { accountId: "a1", amount: 4, id: "t3" });

		const rows = await accountsCellQuery(db);
		expect(rows).toHaveLength(1);
		expect(rows[0].accountId).toBe("a1");
		expect(toCurrencyCell(rows[0]).amount).toBe(4);
	});
});
