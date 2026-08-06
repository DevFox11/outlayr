import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { parseCsv } from "@/domain/csv";
import {
	CSV_HEADER,
	parseCsvAmount,
	parseCsvDate,
} from "@/domain/transaction-csv";
import { transactionsRepo } from "./transactions-core";
import {
	applyImport,
	buildImportPlan,
	exportFileName,
	exportTransactionsCsv,
	guessMapping,
	parseImportFile,
	splitHeaderAndRows,
	uniqueCategoryValues,
} from "./transfer-core";

/**
 * The better-sqlite3 client this suite injects has no `withTransactionAsync`,
 * so `withTransaction` (src/db/transaction.ts) falls back to running its task
 * bare — real by design for every other test here, which asserts statement
 * order and resulting rows, not atomicity. The rollback test below needs the
 * real boundary, so it opts in with manual BEGIN/COMMIT/ROLLBACK over the same
 * connection, mirroring what expo-sqlite's `withTransactionAsync` gives production.
 */
function makeDb(options?: { withRealTransactions?: boolean }): Database {
	const sqlite = new BetterSqlite3(":memory:");
	if (options?.withRealTransactions) {
		const client = sqlite as BetterSqlite3.Database & {
			withTransactionAsync?: (task: () => Promise<void>) => Promise<void>;
		};
		client.withTransactionAsync = async (task) => {
			sqlite.exec("BEGIN");
			try {
				await task();
				sqlite.exec("COMMIT");
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		};
	}
	sqlite.exec(`
		CREATE TABLE appMeta (key text PRIMARY KEY NOT NULL, value text);
		CREATE TABLE exchangeRates (
			quote text NOT NULL, rateType text NOT NULL, date text NOT NULL,
			rate real NOT NULL, source text NOT NULL, fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
		CREATE TABLE categories (
			id text PRIMARY KEY NOT NULL, name text, color text DEFAULT '#FFFFFF',
			icon text, emoji text, income integer NOT NULL DEFAULT 0,
			sortOrder integer NOT NULL DEFAULT 0, dateCreated integer, parentId text,
			updatedAt integer NOT NULL, deletedAt integer
		);
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL, amount real NOT NULL, income integer NOT NULL,
			currency text, note text NOT NULL DEFAULT '', details text,
			date integer NOT NULL, day integer NOT NULL, month integer NOT NULL,
			icon text, emoji text, customColor text, imageColor text, imageUri text, imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0, recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1, recurringEndDate integer, reminderLeadDays integer,
			categoryId text, accountId text, amountUsd real, exchangeRate real, exchangeRateType text,
			updatedAt integer NOT NULL, deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const NOW = new Date(2026, 6, 29, 12);

async function seed(db: Database) {
	await db.insert(categories).values([
		{
			id: "cat-food",
			name: "Groceries",
			income: false,
			sortOrder: 0,
			updatedAt: NOW,
		},
		{
			id: "cat-pay",
			name: "Paycheck",
			income: true,
			sortOrder: 1,
			updatedAt: NOW,
		},
		{
			id: "cat-gone",
			name: "Retired",
			income: false,
			sortOrder: 2,
			updatedAt: NOW,
			deletedAt: NOW,
		},
	]);
}

async function seedTransactions(db: Database) {
	await db.insert(transactions).values([
		{
			id: "t-1",
			amount: 12.5,
			income: false,
			currency: "EUR",
			note: "Bakery, twice",
			date: new Date(2026, 6, 28, 9, 30),
			day: new Date(2026, 6, 28),
			month: new Date(2026, 6, 1),
			categoryId: "cat-food",
			updatedAt: NOW,
		},
		{
			id: "t-2",
			amount: 2400,
			income: true,
			currency: null,
			note: "Salary",
			date: new Date(2026, 6, 27, 8, 0),
			day: new Date(2026, 6, 27),
			month: new Date(2026, 6, 1),
			categoryId: "cat-pay",
			updatedAt: NOW,
		},
		{
			id: "t-dead",
			amount: 99,
			income: false,
			currency: "USD",
			note: "Deleted",
			date: new Date(2026, 6, 26, 8, 0),
			day: new Date(2026, 6, 26),
			month: new Date(2026, 6, 1),
			categoryId: "cat-food",
			updatedAt: NOW,
			deletedAt: NOW,
		},
	]);
}

describe("exportTransactionsCsv", () => {
	let db: Database;
	beforeEach(async () => {
		db = makeDb();
		await seed(db);
		await seedTransactions(db);
	});

	it("omits soft-deleted rows", async () => {
		const csv = await exportTransactionsCsv(db);
		expect(!csv.includes("Deleted")).toBeTruthy();
	});

	it("writes one row per live transaction under the header", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		expect(rows.length).toBe(3);
	});

	it("carries the category name", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		expect(rows[1]?.[4]).toBe("Groceries");
	});

	it("orders newest first", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		const first = parseCsvDate(rows[1]?.[0] ?? "", "ISO");
		const second = parseCsvDate(rows[2]?.[0] ?? "", "ISO");
		expect(first && second && first > second).toBeTruthy();
	});

	it("substitutes the ledger currency for a row that stated none", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		expect(rows[2]?.[3]).toBe("USD");
	});

	it("keeps the amount readable back as the same number", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		expect(parseCsvAmount(rows[1]?.[2] ?? "")).toBe(12.5);
	});

	it("emits a header-only file for an empty ledger", async () => {
		const empty = makeDb();
		expect(parseCsv(await exportTransactionsCsv(empty)).length).toBe(1);
	});
});

describe("exportFileName", () => {
	it("stamps the local day", () => {
		expect(exportFileName(new Date(2026, 6, 5, 23))).toBe(
			"outlayr-2026-07-05.csv",
		);
	});
});

describe("uniqueCategoryValues", () => {
	it("dedupes preserving first appearance", () => {
		const rows = [["Food"], ["Rent"], ["Food"]];
		expect(uniqueCategoryValues(rows, 0)).toStrictEqual(["Food", "Rent"]);
	});

	it("trims and folds case so one category is not asked for twice", () => {
		const rows = [["Food"], ["food "], ["FOOD"]];
		expect(uniqueCategoryValues(rows, 0)).toStrictEqual(["Food"]);
	});

	it("skips rows with no cell at that index", () => {
		const rows = [["Food"], [], ["Rent"]];
		expect(uniqueCategoryValues(rows, 0)).toStrictEqual(["Food", "Rent"]);
	});

	it("skips blank values", () => {
		const rows = [["Food"], ["  "], ["Rent"]];
		expect(uniqueCategoryValues(rows, 0)).toStrictEqual(["Food", "Rent"]);
	});
});

const MAPPING = {
	category: 0,
	note: 1,
	date: 2,
	amount: 3,
	currency: null,
	type: null,
};

describe("parseImportFile", () => {
	it("takes a digit-free first line as a header", () => {
		const parsed = parseImportFile("Date,Note,Amount\n2026-07-28,Bakery,12.50");
		expect(parsed?.header).toStrictEqual(["Date", "Note", "Amount"]);
		expect(parsed?.rows.length).toBe(1);
	});

	it("keeps a first line that already carries data", () => {
		const parsed = parseImportFile("2026-07-28,Bakery,12.50");
		expect(parsed?.header).toBe(null);
		expect(parsed?.rows.length).toBe(1);
	});

	it("reports the widest row so a ragged file still maps", () => {
		expect(parseImportFile("a,b,c\n1,2,3,4")?.width).toBe(4);
	});

	it("rejects a file with too few columns to build a row", () => {
		expect(parseImportFile("2026-07-28,12.50")).toBe(null);
	});

	it("rejects an empty file", () => {
		expect(parseImportFile("")).toBe(null);
	});

	it("rejects a file that is nothing but a header", () => {
		expect(parseImportFile("Date,Note,Amount\n")).toBe(null);
	});
});

describe("splitHeaderAndRows", () => {
	it("splits off a digit-free first line as the header", () => {
		expect(
			splitHeaderAndRows([
				["Date", "Note", "Amount"],
				["2026-07-28", "Bakery", "12.50"],
			]),
		).toStrictEqual({
			header: ["Date", "Note", "Amount"],
			rows: [["2026-07-28", "Bakery", "12.50"]],
		});
	});

	it("keeps a first line that already carries data", () => {
		expect(
			splitHeaderAndRows([["2026-07-28", "Bakery", "12.50"]]),
		).toStrictEqual({
			header: null,
			rows: [["2026-07-28", "Bakery", "12.50"]],
		});
	});

	it("preserves ragged rows unchanged", () => {
		expect(
			splitHeaderAndRows([
				["a", "b", "c"],
				["1", "2", "3", "4"],
			]),
		).toStrictEqual({
			header: ["a", "b", "c"],
			rows: [["1", "2", "3", "4"]],
		});
	});
});

describe("guessMapping", () => {
	it("maps a file this app exported without asking", () => {
		expect(guessMapping([...CSV_HEADER])).toStrictEqual({
			date: 0,
			note: 1,
			amount: 2,
			currency: 3,
			category: 4,
			type: 5,
		});
	});

	it("recognises the words a bank export uses", () => {
		const guess = guessMapping(["Posted", "Description", "Debit", "Category"]);
		expect(guess.date).toBe(0);
		expect(guess.note).toBe(1);
		expect(guess.amount).toBe(2);
		expect(guess.category).toBe(3);
	});

	it("ignores case and padding", () => {
		expect(guessMapping([" DATE "]).date).toBe(0);
	});

	it("never assigns one column to two fields", () => {
		const guess = guessMapping(["Date", "Date"]);
		expect(guess.date).not.toBe(null);
		const used = Object.values(guess).filter((value) => value != null);
		expect(new Set(used).size).toBe(used.length);
	});

	it("leaves a field it cannot place unassigned", () => {
		expect(guessMapping(["col1", "col2"]).amount).toBe(null);
	});
});

describe("buildImportPlan", () => {
	const rows = [
		["Food", "Bakery", "2026-07-28", "12.50"],
		["Pay", "Salary", "2026-07-27", "2400"],
	];
	const links = new Map([
		["food", "cat-food"],
		["pay", "cat-pay"],
	]);
	const income = new Map([
		["cat-food", false],
		["cat-pay", true],
	]);

	it("parses every readable row", () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries.length).toBe(2);
		expect(plan.skipped.length).toBe(0);
	});

	it("takes direction from the matched category", () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.income).toBe(false);
		expect(plan.entries[1]?.income).toBe(true);
	});

	it("prefers an explicit type column over the category's direction", () => {
		const typed = rows.map((row) => [...row, "Income"]);
		const plan = buildImportPlan(
			typed,
			{ ...MAPPING, type: 4 },
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.income).toBe(true);
	});

	it("stores the magnitude, never a signed amount", () => {
		const negative = [["Food", "Refund", "2026-07-28", "-12.50"]];
		const plan = buildImportPlan(
			negative,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.amount).toBe(12.5);
	});

	it("reads a mapped currency column", () => {
		const withCurrency = rows.map((row) => [...row, "eur"]);
		const plan = buildImportPlan(
			withCurrency,
			{ ...MAPPING, currency: 4 },
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.currency).toBe("EUR");
	});

	it("leaves currency null when no column is mapped, so the ledger's code applies", () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.currency).toBe(null);
	});

	it("rejects a currency cell that is not a three-letter code", () => {
		const bad = [["Food", "Bakery", "2026-07-28", "12.50", "dollars"]];
		const plan = buildImportPlan(
			bad,
			{ ...MAPPING, currency: 4 },
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.currency).toBe(null);
	});

	it("skips a row whose date does not parse and names the reason", () => {
		const bad = [...rows, ["Food", "Mystery", "last tuesday", "5"]];
		const plan = buildImportPlan(
			bad,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries.length).toBe(2);
		expect(plan.skipped).toStrictEqual([{ row: 3, reason: "date" }]);
	});

	it("skips a row whose amount does not parse", () => {
		const bad = [["Food", "Mystery", "2026-07-28", "n/a"]];
		const plan = buildImportPlan(
			bad,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.skipped).toStrictEqual([{ row: 1, reason: "amount" }]);
	});

	it("skips a row whose category value was never linked", () => {
		const bad = [["Travel", "Flight", "2026-07-28", "300"]];
		const plan = buildImportPlan(
			bad,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.skipped).toStrictEqual([{ row: 1, reason: "category" }]);
	});

	it("skips a ragged row missing the mapped column entirely", () => {
		const bad = [["Food", "Bakery"]];
		const plan = buildImportPlan(
			bad,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries.length).toBe(0);
		expect(plan.skipped.length).toBe(1);
	});

	it("carries a blank note through as blank, leaving the fallback to the write", () => {
		const blank = [["Food", "  ", "2026-07-28", "12.50"]];
		const plan = buildImportPlan(
			blank,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.entries[0]?.note).toBe("");
	});

	it("reports the date span of what it will write", () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		expect(plan.earliest).toStrictEqual(new Date(2026, 6, 27));
		expect(plan.latest).toStrictEqual(new Date(2026, 6, 28));
	});

	it("reports no span when nothing is importable", () => {
		const plan = buildImportPlan([], MAPPING, "yyyy-MM-dd", ".", links, income);
		expect(plan.earliest).toBe(null);
		expect(plan.latest).toBe(null);
	});
});

describe("applyImport", () => {
	let db: Database;
	beforeEach(async () => {
		db = makeDb();
		await seed(db);
	});

	const rows = [
		["Food", "Bakery", "2026-07-28", "12.50"],
		["Pay", "Salary", "2026-07-27", "2400"],
	];
	const links = new Map([
		["food", "cat-food"],
		["pay", "cat-pay"],
	]);
	const income = new Map([
		["cat-food", false],
		["cat-pay", true],
	]);

	it("writes every planned entry", async () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		const written = await applyImport(db, plan);
		expect(written).toBe(2);
		expect((await db.select().from(transactions)).length).toBe(2);
	});

	it("buckets each row into its own day and month", async () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		await applyImport(db, plan);
		const rowsOut = await db.select().from(transactions);
		const first = rowsOut.find((row) => row.note === "Bakery");
		expect(first?.day).toStrictEqual(new Date(2026, 6, 28));
		expect(first?.month).toStrictEqual(new Date(2026, 6, 1));
	});

	it("writes nothing at all when there is nothing to write", async () => {
		const plan = buildImportPlan([], MAPPING, "yyyy-MM-dd", ".", links, income);
		expect(await applyImport(db, plan)).toBe(0);
		expect((await db.select().from(transactions)).length).toBe(0);
	});

	it("rolls back every entry when the write fails partway through", async () => {
		const transactionalDb = makeDb({ withRealTransactions: true });
		await seed(transactionalDb);
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		const originalCreate = transactionsRepo.create;
		let calls = 0;
		const spy = jest
			.spyOn(transactionsRepo, "create")
			.mockImplementation(async (targetDb, input) => {
				calls += 1;
				if (calls === 2) {
					throw new Error("disk full");
				}
				return originalCreate(targetDb, input);
			});

		await expect(applyImport(transactionalDb, plan)).rejects.toThrow(
			"disk full",
		);
		expect((await transactionalDb.select().from(transactions)).length).toBe(0);

		spy.mockRestore();
	});

	it("leaves imported rows non-recurring", async () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		await applyImport(db, plan);
		const rowsOut = await db.select().from(transactions);
		expect(rowsOut.every((row) => row.recurringType === 0)).toBeTruthy();
		expect(rowsOut.every((row) => !row.onceRecurring)).toBeTruthy();
	});

	it("names a blank-note row after its category", async () => {
		const blank = [["Food", "  ", "2026-07-28", "12.50"]];
		const plan = buildImportPlan(
			blank,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		await applyImport(db, plan);
		const rowsOut = await db.select().from(transactions);
		expect(rowsOut[0]?.note).toBe("Groceries");
	});

	it("stamps the ledger currency on rows that named none", async () => {
		const plan = buildImportPlan(
			rows,
			MAPPING,
			"yyyy-MM-dd",
			".",
			links,
			income,
		);
		await applyImport(db, plan);
		const rowsOut = await db.select().from(transactions);
		expect(rowsOut.every((row) => row.currency === "USD")).toBeTruthy();
	});

	it("round-trips an export back to the same figures", async () => {
		await seedTransactions(db);
		const csv = await exportTransactionsCsv(db);
		const parsed = parseCsv(csv).slice(1);
		const plan = buildImportPlan(
			parsed,
			{ category: 4, note: 1, date: 0, amount: 2, currency: 3, type: 5 },
			"ISO",
			".",
			new Map([
				["groceries", "cat-food"],
				["paycheck", "cat-pay"],
			]),
			income,
		);
		expect(plan.skipped.length).toBe(0);
		expect(plan.entries.length).toBe(2);

		const bakery = plan.entries.find((entry) => entry.note === "Bakery, twice");
		expect(bakery?.amount).toBe(12.5);
		expect(bakery?.currency).toBe("EUR");
		expect(bakery?.income).toBe(false);
		expect(bakery?.date.getTime()).toBe(new Date(2026, 6, 28, 9, 30).getTime());

		const salary = plan.entries.find((entry) => entry.note === "Salary");
		expect(salary?.amount).toBe(2400);
		expect(salary?.income).toBe(true);
	});
});
