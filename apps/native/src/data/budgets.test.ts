import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { appMeta, budgets, exchangeRates, mainBudget } from "@/db/schema";
import { BUDGET_TYPE, shiftWindow, startOfPeriod } from "@/domain/budget-math";
import { buildRateTable, limitIn } from "@/domain/valuation";
import { budgetsRepo, getBudgetById } from "./budgets-core";

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

	it("anchors an omitted start date to the user's own week", async () => {
		await db.insert(appMeta).values({ key: "firstWeekday", value: "2" });
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.week,
		});
		const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(
			row?.startDate?.getTime(),
			startOfPeriod(new Date(), BUDGET_TYPE.week, {
				firstWeekday: 2,
				firstDayOfMonth: 1,
			}).getTime(),
		);
	});

	it("anchors an omitted start date to the user's own month", async () => {
		await db.insert(appMeta).values({ key: "firstDayOfMonth", value: "25" });
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
		});
		const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
		assert.equal(
			row?.startDate?.getTime(),
			startOfPeriod(new Date(), BUDGET_TYPE.month, {
				firstWeekday: 1,
				firstDayOfMonth: 25,
			}).getTime(),
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

describe("getBudgetById", () => {
	it("hands back the stored row so an edit opens on what was saved", async () => {
		const db = makeDb();
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
			name: "Coffee run",
			startDate: BACKDATE,
		});
		const row = getBudgetById(db, id);
		assert.equal(row?.name, "Coffee run");
		assert.equal(row?.amount, 250);
		assert.equal(row?.categoryId, "cat-1");
		assert.equal(row?.type, BUDGET_TYPE.month);
		assert.equal(row?.startDate?.getTime(), BACKDATE.getTime());
	});

	it("declines an id that names nothing", () => {
		assert.equal(getBudgetById(makeDb(), "gone"), null);
	});
});

describe("budgetsRepo.updateBudget", () => {
	it("keeps the anchor an edit did not touch", async () => {
		// The whole point of editing rather than delete-and-recreate: a mistyped
		// target must not cost the user the window the budget has been running in.
		const db = makeDb();
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 250,
			type: BUDGET_TYPE.month,
			startDate: BACKDATE,
		});

		const existing = getBudgetById(db, id);
		await budgetsRepo.updateBudget(db, id, {
			categoryId: existing?.categoryId ?? "cat-1",
			amount: 300,
			type: existing?.type ?? BUDGET_TYPE.month,
			name: existing?.name,
			startDate: existing?.startDate,
		});

		const row = getBudgetById(db, id);
		assert.equal(row?.amount, 300);
		assert.equal(row?.startDate?.getTime(), BACKDATE.getTime());
	});

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

describe("an edited budget stays coherent", () => {
	it("keeps its settings-derived anchor and agrees with limitIn on both sides", async () => {
		const db = makeDb();
		await db.insert(appMeta).values([
			{ key: "currency", value: "EUR" },
			{ key: "firstDayOfMonth", value: "25" },
		]);
		await db.insert(exchangeRates).values({
			quote: "EUR",
			rateType: "official",
			date: "2020-01-01",
			rate: 0.9,
			source: "frankfurter",
			fetchedAt: 0,
		});
		const rates = buildRateTable([
			{ quote: "EUR", date: "2020-01-01", rate: 0.9 },
		]);

		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 450,
			type: BUDGET_TYPE.month,
		});
		const anchor = startOfPeriod(new Date(), BUDGET_TYPE.month, {
			firstWeekday: 1,
			firstDayOfMonth: 25,
		});

		const created = getBudgetById(db, id);
		assert.ok(created);
		assert.equal(created.startDate?.getTime(), anchor.getTime());
		assert.equal(created.amountUsd, 500);
		assert.equal(limitIn(created, anchor, "USD", rates), 500);

		await budgetsRepo.updateBudget(db, id, {
			categoryId: created.categoryId ?? "cat-1",
			amount: 900,
			type: created.type,
			name: created.name,
			startDate: created.startDate,
		});

		const edited = getBudgetById(db, id);
		assert.ok(edited);
		assert.equal(edited.startDate?.getTime(), anchor.getTime());
		assert.equal(edited.amountUsd, 1000);
		assert.equal(limitIn(edited, anchor, "USD", rates), 1000);
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

	it("freezes the USD value on the day the anchored window opens", async () => {
		// `limitIn` restates the target at the window's day, so a value frozen at
		// the write instant would be converted from a rate it was never set at.
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(exchangeRates).values([
			{
				quote: "EUR",
				rateType: "official",
				date: "2026-02-01",
				rate: 0.9,
				source: "frankfurter",
				fetchedAt: 0,
			},
			{
				quote: "EUR",
				rateType: "official",
				date: "2026-06-01",
				rate: 0.5,
				source: "frankfurter",
				fetchedAt: 0,
			},
		]);

		const id = await budgetsRepo.createBudget(db, {
			amount: 400,
			type: BUDGET_TYPE.month,
			categoryId: "cat",
			startDate: BACKDATE,
		});

		const [row] = await db
			.select({ amountUsd: budgets.amountUsd })
			.from(budgets)
			.where(eq(budgets.id, id));
		// 400 EUR / 0.9, February's rate — not 0.5, the rate on the day of the write.
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

describe("a budget stepped back to a closed window", () => {
	it("values its limit at that window's day, not at the current one", async () => {
		// The rule PR #157 settled: the target is subtracted from spending valued
		// at the window's own days, so stepping back to March must restate the
		// limit in March money or the leftover means nothing.
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(exchangeRates).values([
			{
				quote: "EUR",
				rateType: "official",
				date: "2026-03-01",
				rate: 0.9,
				source: "frankfurter",
				fetchedAt: 0,
			},
			{
				quote: "EUR",
				rateType: "official",
				date: "2026-07-01",
				rate: 0.5,
				source: "frankfurter",
				fetchedAt: 0,
			},
		]);
		const rates = buildRateTable([
			{ quote: "EUR", date: "2026-03-01", rate: 0.9 },
			{ quote: "EUR", date: "2026-07-01", rate: 0.5 },
		]);

		const current = new Date(2026, 6, 1);
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 450,
			type: BUDGET_TYPE.month,
			startDate: current,
		});
		const row = getBudgetById(db, id);
		assert.ok(row);

		const july = shiftWindow(current, BUDGET_TYPE.month, 0);
		const march = shiftWindow(current, BUDGET_TYPE.month, -4);
		assert.deepEqual(march.start, new Date(2026, 2, 1));

		assert.equal(limitIn(row, july.start, "USD", rates), 900);
		assert.equal(limitIn(row, march.start, "USD", rates), 500);
	});

	it("falls back to the frozen value when no rate reaches the window", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "currency", value: "EUR" });
		await db.insert(exchangeRates).values({
			quote: "EUR",
			rateType: "official",
			date: "2026-07-01",
			rate: 0.5,
			source: "frankfurter",
			fetchedAt: 0,
		});
		const rates = buildRateTable([
			{ quote: "EUR", date: "2026-07-01", rate: 0.5 },
		]);

		const current = new Date(2026, 6, 1);
		const id = await budgetsRepo.createBudget(db, {
			categoryId: "cat-1",
			amount: 450,
			type: BUDGET_TYPE.month,
			startDate: current,
		});
		const row = getBudgetById(db, id);
		assert.ok(row);

		const march = shiftWindow(current, BUDGET_TYPE.month, -4);
		// 450 / 0.5: the write-time freeze, since March predates every EUR rate.
		assert.equal(limitIn(row, march.start, "USD", rates), 900);
	});
});
