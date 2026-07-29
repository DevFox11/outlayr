import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
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
import {
	applyImport,
	buildImportPlan,
	exportFileName,
	exportTransactionsCsv,
	guessMapping,
	parseImportFile,
	uniqueCategoryValues,
} from "./transfer-core";

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
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
			recurringCoefficient integer NOT NULL DEFAULT 1, recurringEndDate integer,
			categoryId text, amountUsd real, exchangeRate real, exchangeRateType text,
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
		assert.ok(!csv.includes("Deleted"));
	});

	it("writes one row per live transaction under the header", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		assert.equal(rows.length, 3);
	});

	it("carries the category name", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		assert.equal(rows[1]?.[4], "Groceries");
	});

	it("orders newest first", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		const first = parseCsvDate(rows[1]?.[0] ?? "", "ISO");
		const second = parseCsvDate(rows[2]?.[0] ?? "", "ISO");
		assert.ok(first && second && first > second);
	});

	it("substitutes the ledger currency for a row that stated none", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		assert.equal(rows[2]?.[3], "USD");
	});

	it("keeps the amount readable back as the same number", async () => {
		const rows = parseCsv(await exportTransactionsCsv(db));
		assert.equal(parseCsvAmount(rows[1]?.[2] ?? ""), 12.5);
	});

	it("emits a header-only file for an empty ledger", async () => {
		const empty = makeDb();
		assert.equal(parseCsv(await exportTransactionsCsv(empty)).length, 1);
	});
});

describe("exportFileName", () => {
	it("stamps the local day", () => {
		assert.equal(
			exportFileName(new Date(2026, 6, 5, 23)),
			"outlayr-2026-07-05.csv",
		);
	});
});

describe("uniqueCategoryValues", () => {
	it("dedupes preserving first appearance", () => {
		const rows = [["Food"], ["Rent"], ["Food"]];
		assert.deepEqual(uniqueCategoryValues(rows, 0), ["Food", "Rent"]);
	});

	it("trims and folds case so one category is not asked for twice", () => {
		const rows = [["Food"], ["food "], ["FOOD"]];
		assert.deepEqual(uniqueCategoryValues(rows, 0), ["Food"]);
	});

	it("skips rows with no cell at that index", () => {
		const rows = [["Food"], [], ["Rent"]];
		assert.deepEqual(uniqueCategoryValues(rows, 0), ["Food", "Rent"]);
	});

	it("skips blank values", () => {
		const rows = [["Food"], ["  "], ["Rent"]];
		assert.deepEqual(uniqueCategoryValues(rows, 0), ["Food", "Rent"]);
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
		assert.deepEqual(parsed?.header, ["Date", "Note", "Amount"]);
		assert.equal(parsed?.rows.length, 1);
	});

	it("keeps a first line that already carries data", () => {
		const parsed = parseImportFile("2026-07-28,Bakery,12.50");
		assert.equal(parsed?.header, null);
		assert.equal(parsed?.rows.length, 1);
	});

	it("reports the widest row so a ragged file still maps", () => {
		assert.equal(parseImportFile("a,b,c\n1,2,3,4")?.width, 4);
	});

	it("rejects a file with too few columns to build a row", () => {
		assert.equal(parseImportFile("2026-07-28,12.50"), null);
	});

	it("rejects an empty file", () => {
		assert.equal(parseImportFile(""), null);
	});

	it("rejects a file that is nothing but a header", () => {
		assert.equal(parseImportFile("Date,Note,Amount\n"), null);
	});
});

describe("guessMapping", () => {
	it("maps a file this app exported without asking", () => {
		assert.deepEqual(guessMapping([...CSV_HEADER]), {
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
		assert.equal(guess.date, 0);
		assert.equal(guess.note, 1);
		assert.equal(guess.amount, 2);
		assert.equal(guess.category, 3);
	});

	it("ignores case and padding", () => {
		assert.equal(guessMapping([" DATE "]).date, 0);
	});

	it("never assigns one column to two fields", () => {
		const guess = guessMapping(["Date", "Date"]);
		assert.notEqual(guess.date, null);
		const used = Object.values(guess).filter((value) => value != null);
		assert.equal(new Set(used).size, used.length);
	});

	it("leaves a field it cannot place unassigned", () => {
		assert.equal(guessMapping(["col1", "col2"]).amount, null);
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
		assert.equal(plan.entries.length, 2);
		assert.equal(plan.skipped.length, 0);
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
		assert.equal(plan.entries[0]?.income, false);
		assert.equal(plan.entries[1]?.income, true);
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
		assert.equal(plan.entries[0]?.income, true);
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
		assert.equal(plan.entries[0]?.amount, 12.5);
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
		assert.equal(plan.entries[0]?.currency, "EUR");
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
		assert.equal(plan.entries[0]?.currency, null);
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
		assert.equal(plan.entries[0]?.currency, null);
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
		assert.equal(plan.entries.length, 2);
		assert.deepEqual(plan.skipped, [{ row: 3, reason: "date" }]);
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
		assert.deepEqual(plan.skipped, [{ row: 1, reason: "amount" }]);
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
		assert.deepEqual(plan.skipped, [{ row: 1, reason: "category" }]);
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
		assert.equal(plan.entries.length, 0);
		assert.equal(plan.skipped.length, 1);
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
		assert.equal(plan.entries[0]?.note, "");
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
		assert.deepEqual(plan.earliest, new Date(2026, 6, 27));
		assert.deepEqual(plan.latest, new Date(2026, 6, 28));
	});

	it("reports no span when nothing is importable", () => {
		const plan = buildImportPlan([], MAPPING, "yyyy-MM-dd", ".", links, income);
		assert.equal(plan.earliest, null);
		assert.equal(plan.latest, null);
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
		assert.equal(written, 2);
		assert.equal((await db.select().from(transactions)).length, 2);
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
		assert.deepEqual(first?.day, new Date(2026, 6, 28));
		assert.deepEqual(first?.month, new Date(2026, 6, 1));
	});

	it("writes nothing at all when there is nothing to write", async () => {
		const plan = buildImportPlan([], MAPPING, "yyyy-MM-dd", ".", links, income);
		assert.equal(await applyImport(db, plan), 0);
		assert.equal((await db.select().from(transactions)).length, 0);
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
		assert.ok(rowsOut.every((row) => row.recurringType === 0));
		assert.ok(rowsOut.every((row) => !row.onceRecurring));
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
		assert.equal(rowsOut[0]?.note, "Groceries");
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
		assert.ok(rowsOut.every((row) => row.currency === "USD"));
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
		assert.equal(plan.skipped.length, 0);
		assert.equal(plan.entries.length, 2);

		const bakery = plan.entries.find((entry) => entry.note === "Bakery, twice");
		assert.equal(bakery?.amount, 12.5);
		assert.equal(bakery?.currency, "EUR");
		assert.equal(bakery?.income, false);
		assert.equal(
			bakery?.date.getTime(),
			new Date(2026, 6, 28, 9, 30).getTime(),
		);

		const salary = plan.entries.find((entry) => entry.note === "Salary");
		assert.equal(salary?.amount, 2400);
		assert.equal(salary?.income, true);
	});
});
