import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { appMeta, budgets, exchangeRates, mainBudget } from "@/db/schema";
import { BUDGET_TYPE, startOfPeriod } from "@/domain/budget-math";
import { budgetsRepo } from "./budgets-core";

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE appMeta (
			key text PRIMARY KEY NOT NULL,
			value text
		);
		CREATE TABLE exchangeRates (
			quote text NOT NULL,
			rateType text NOT NULL,
			date text NOT NULL,
			rate real NOT NULL,
			source text NOT NULL,
			fetchedAt integer NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
		CREATE TABLE budgets (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			categoryId text UNIQUE,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE mainBudget (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const BACKDATE = new Date(2026, 1, 9, 14, 30, 0, 0);

describe("budgetsRepo.createBudget", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("persists a passed start date verbatim", async () => {
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
			startDate: BACKDATE,
		});
		const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(row?.startDate?.getTime(), BACKDATE.getTime());
	});

	it("anchors an omitted start date to the period start", async () => {
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
		});
		const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(
			row?.startDate?.getTime(),
			startOfPeriod(new Date(), BUDGET_TYPE.month).getTime(),
		);
	});

	it("stores a trimmed custom name and nulls a blank one", async () => {
		const named = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
			name: "  Coffee run  ",
		});
		const blank = await budgetsRepo.createBudget(db, {
			categoryId: "cat-2",
			amount: 250,
			type: BUDGET_TYPE.month,
			name: "   ",
		});
		const rows = await db.select().from(budgets);
		assert.equal(rows.find((r) => r.id === named)?.name, "Coffee run");
		assert.equal(rows.find((r) => r.id === blank)?.name, null);
	});
});

describe("budgetsRepo.createMainBudget", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("persists a passed start date verbatim", async () => {
		const id = await budgetsRepo.createMainBudget(db, {
			amount: 1000,
			type: BUDGET_TYPE.week,
			startDate: BACKDATE,
		});
		const [row] = await db
			.select()
			.from(mainBudget)
			.where(eq(mainBudget.id, id));
		assert.equal(row?.startDate?.getTime(), BACKDATE.getTime());
	});

	it("anchors an omitted start date to the period start", async () => {
		const id = await budgetsRepo.createMainBudget(db, {
			amount: 1000,
			type: BUDGET_TYPE.week,
		});
		const [row] = await db
			.select()
			.from(mainBudget)
			.where(eq(mainBudget.id, id));
		assert.equal(
			row?.startDate?.getTime(),
			startOfPeriod(new Date(), BUDGET_TYPE.week).getTime(),
		);
	});

	it("re-points the singleton rather than inserting a second", async () => {
		const first = await budgetsRepo.createMainBudget(db, {
			amount: 1000,
			type: BUDGET_TYPE.month,
			name: "Everything",
		});
		const second = await budgetsRepo.createMainBudget(db, {
			amount: 1200,
			type: BUDGET_TYPE.month,
			startDate: BACKDATE,
		});
		const rows = await db.select().from(mainBudget);
		assert.equal(second, first);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.amount, 1200);
		assert.equal(rows[0]?.startDate?.getTime(), BACKDATE.getTime());
	});

	it("keeps an existing name when the caller supplies none", async () => {
		// The form opens on Overall with the name field blank, so a re-save must
		// not silently erase what the budget was already called.
		await budgetsRepo.createMainBudget(db, {
			amount: 1000,
			type: BUDGET_TYPE.month,
			name: "Household",
		});
		await budgetsRepo.createMainBudget(db, {
			amount: 3500,
			type: BUDGET_TYPE.month,
		});
		const rows = await db.select().from(mainBudget);
		assert.equal(rows[0]?.name, "Household");
	});

	it("clears the name when the caller explicitly blanks it", async () => {
		await budgetsRepo.createMainBudget(db, {
			amount: 1000,
			type: BUDGET_TYPE.month,
			name: "Household",
		});
		await budgetsRepo.createMainBudget(db, {
			amount: 3500,
			type: BUDGET_TYPE.month,
			name: "   ",
		});
		const rows = await db.select().from(mainBudget);
		assert.equal(rows[0]?.name, null);
	});
});

describe("budgetsRepo.updateBudget", () => {
	it("honours an explicit start date and falls back to the period start", async () => {
		const db = makeDb();
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
		});

		await budgetsRepo.updateBudget(db, id, {
			categoryId: "cat-1",
			amount: 300,
			type: BUDGET_TYPE.month,
			startDate: BACKDATE,
		});
		let [row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(row?.startDate?.getTime(), BACKDATE.getTime());

		await budgetsRepo.updateBudget(db, id, {
			categoryId: "cat-1",
			amount: 300,
			type: BUDGET_TYPE.month,
		});
		[row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(
			row?.startDate?.getTime(),
			startOfPeriod(new Date(), BUDGET_TYPE.month).getTime(),
		);
	});
});

describe("budgetsRepo stamps the currency it was set in", () => {
	it("names the ledger's currency and freezes the target's USD value", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(exchangeRates).values({
			quote: "EUR",
			rateType: "official",
			date: "2020-01-01",
			rate: 0.9,
			source: "frankfurter",
			fetchedAt: 0,
		});

		const id = await budgetsRepo.createBudget(db, {
			name: null,
			amount: 400,
			type: 3,
			categoryId: "cat",
			startDate: null,
		});

		const [row] = await db
			.select({
				amount: budgets.amount,
				currency: budgets.currency,
				amountUsd: budgets.amountUsd,
			})
			.from(budgets)
			.where(eq(budgets.id, id));
		assert.equal(row.amount, 400);
		assert.equal(row.currency, "EUR");
		// 400 EUR / 0.9.
		assert.equal(Math.round((row.amountUsd ?? 0) * 100) / 100, 444.44);
	});

	it("stores the amount unsigned", async () => {
		const db = makeDb();
		const id = await budgetsRepo.createBudget(db, {
			name: null,
			amount: -250,
			type: 3,
			categoryId: "cat",
			startDate: null,
		});
		const [row] = await db
			.select({ amount: budgets.amount })
			.from(budgets)
			.where(eq(budgets.id, id));
		assert.equal(row.amount, 250);
	});
});
