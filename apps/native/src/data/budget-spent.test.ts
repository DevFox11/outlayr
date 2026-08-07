import { utcDateString } from "@outlayr/money";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { categories, transactions } from "@/db/schema";
import { buildRateTable, sumValuedIn, valueIn } from "@/domain/valuation";
import {
	type ExpenseContribution,
	expenseContributionQuery,
	spentForCategory,
	spentForMain,
} from "./budget-spent";

type TestDb = ReturnType<typeof drizzle>;

const at = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);
const WINDOW_START = at(2025, 1, 1);
const NOW = at(2025, 1, 31);

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

async function seed(db: TestDb): Promise<void> {
	const now = new Date();
	await db.insert(categories).values([
		{ id: "food", name: "Food", income: false, sortOrder: 0, updatedAt: now },
		{
			id: "groc",
			name: "Groceries",
			income: false,
			parentId: "food",
			sortOrder: 1,
			updatedAt: now,
		},
		{ id: "rent", name: "Rent", income: false, sortOrder: 2, updatedAt: now },
		{ id: "sal", name: "Salary", income: true, sortOrder: 0, updatedAt: now },
	]);
	const base = {
		note: "",
		day: WINDOW_START,
		month: WINDOW_START,
		onceRecurring: false,
		recurringType: 0,
		recurringCoefficient: 1,
		updatedAt: now,
	};
	await db.insert(transactions).values([
		// In-window expenses that count.
		{
			...base,
			id: "t-food",
			amount: 10,
			income: false,
			categoryId: "food",
			date: at(2025, 1, 10),
		},
		{
			...base,
			id: "t-groc",
			amount: 20,
			income: false,
			categoryId: "groc",
			date: at(2025, 1, 15),
		},
		{
			...base,
			id: "t-rent",
			amount: 100,
			income: false,
			categoryId: "rent",
			date: at(2025, 1, 20),
		},
		// Income is never spending.
		{
			...base,
			id: "t-inc",
			amount: 500,
			income: true,
			categoryId: "sal",
			date: at(2025, 1, 12),
		},
		// Before the window.
		{
			...base,
			id: "t-before",
			amount: 5,
			income: false,
			categoryId: "food",
			date: at(2024, 12, 20),
		},
		// After `now`.
		{
			...base,
			id: "t-after",
			amount: 7,
			income: false,
			categoryId: "food",
			date: at(2025, 2, 5),
		},
		// Soft-deleted.
		{
			...base,
			id: "t-del",
			amount: 999,
			income: false,
			categoryId: "food",
			date: at(2025, 1, 18),
			deletedAt: now,
		},
	]);
}

// The reactive hooks load one expense set (non-deleted, income=false, date<=now)
// and bucket in JS; this mirrors that query result.
const CONTRIBUTIONS: ExpenseContribution[] = [
	{ amount: 10, categoryId: "food", parentId: null, date: at(2025, 1, 10) },
	{ amount: 20, categoryId: "groc", parentId: "food", date: at(2025, 1, 15) },
	{ amount: 100, categoryId: "rent", parentId: null, date: at(2025, 1, 20) },
	{ amount: 5, categoryId: "food", parentId: null, date: at(2024, 12, 20) },
];

describe("expenseContributionQuery", () => {
	let db: TestDb;
	beforeAll(async () => {
		db = makeDb();
		await seed(db);
	});

	it("admits only expenses, dated no later than now, never soft-deleted", async () => {
		// Every budget figure is a JS reduction over this one result, so a row that
		// slips through here is spend nothing downstream removes.
		const rows = await expenseContributionQuery(db, NOW);
		expect(rows.map((row) => row.amount).sort((a, b) => a - b)).toStrictEqual([
			5, 10, 20, 100,
		]);
	});

	it("hides a future-dated expense until its day arrives", async () => {
		const rows = await expenseContributionQuery(db, at(2025, 1, 12));
		expect(rows.map((row) => row.amount).sort((a, b) => a - b)).toStrictEqual([
			5, 10,
		]);
	});

	it("carries the currency columns the valuation needs", async () => {
		const rows = await expenseContributionQuery(db, NOW);
		for (const row of rows) {
			expect("currency" in row && "amountUsd" in row).toBeTruthy();
		}
	});
});

describe("spentForCategory", () => {
	it("sums a category together with its subcategories", () => {
		expect(spentForCategory(CONTRIBUTIONS, "food", WINDOW_START, NOW)).toBe(30);
	});

	it("counts only the exact category when it has no children", () => {
		expect(spentForCategory(CONTRIBUTIONS, "groc", WINDOW_START, NOW)).toBe(20);
		expect(spentForCategory(CONTRIBUTIONS, "rent", WINDOW_START, NOW)).toBe(
			100,
		);
	});

	it("respects the window lower bound", () => {
		// Widening the window back to December pulls in the 5.00 expense.
		expect(spentForCategory(CONTRIBUTIONS, "food", at(2024, 12, 1), NOW)).toBe(
			35,
		);
	});
});

describe("spentForMain", () => {
	it("sums every in-window expense across categories", () => {
		expect(spentForMain(CONTRIBUTIONS, WINDOW_START, NOW)).toBe(130);
	});

	it("respects the window lower bound", () => {
		expect(spentForMain(CONTRIBUTIONS, at(2024, 12, 1), NOW)).toBe(135);
	});
});

describe("a budget's spend does not depend on which list it is summed from", () => {
	// The detail screen queries its own contributing rows instead of sharing the
	// list every other budget surface reads, so the conversion has to be applied
	// twice or the hero contradicts the rows printed under it.
	const RATES = buildRateTable([
		{ quote: "EUR", date: "2026-07-01", rate: 0.8 },
	]);
	const JULY_15 = new Date(Date.UTC(2026, 6, 15, 12));
	const ROWS = [
		{
			amount: 40,
			currency: "EUR",
			amountUsd: 50,
			date: JULY_15,
			categoryId: "food",
		},
		{
			amount: 50,
			currency: "USD",
			amountUsd: null,
			date: JULY_15,
			categoryId: "food",
		},
	];

	it("agrees with the shared expense list, in the display currency", () => {
		const shared: ExpenseContribution[] = ROWS.map((row) => ({
			categoryId: row.categoryId,
			parentId: null,
			date: row.date,
			amount: valueIn(
				{
					amount: row.amount,
					currency: row.currency,
					amountUsd: row.amountUsd,
					dateKey: utcDateString(row.date.getTime()),
				},
				"EUR",
				RATES,
			),
		}));

		const fromShared = spentForCategory(
			shared,
			"food",
			new Date(Date.UTC(2026, 6, 1)),
			new Date(Date.UTC(2026, 6, 31)),
		);
		const fromDetail = sumValuedIn(ROWS, "EUR", RATES);

		expect(fromDetail).toBe(80);
		expect(fromDetail).toBe(fromShared);
	});
});
