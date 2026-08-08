import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SpendDb } from "@/data/budget-spent";
import {
	appMeta,
	budgets,
	categories,
	mainBudget,
	transactions,
} from "@/db/schema";
import { buildWidgetProps } from "./props";

function makeDb(): SpendDb {
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
		CREATE TABLE budgets (
			id text PRIMARY KEY NOT NULL,
			name text,
			amount real NOT NULL,
			type integer NOT NULL,
			startDate integer,
			dateCreated integer,
			green integer NOT NULL DEFAULT 0,
			rollover integer NOT NULL DEFAULT 0,
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
			rollover integer NOT NULL DEFAULT 0,
			currency text,
			amountUsd real,
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
	return drizzle(sqlite) as unknown as SpendDb;
}

const NOW = new Date(Date.UTC(2026, 6, 28, 12));

describe("the Ledger widget's entries", () => {
	it("quotes each entry in the currency it was kept in", async () => {
		// Pinning every row to the display currency would turn 12,000 yen into
		// twelve thousand dollars on the home screen.
		const db = makeDb();
		await db.insert(categories).values({
			id: "cat-1",
			name: "Food",
			color: "#FF0000",
			income: false,
			updatedAt: NOW,
		});
		await db.insert(transactions).values({
			id: "t1",
			amount: 12_000,
			income: false,
			currency: "JPY",
			note: "Ramen",
			date: NOW,
			day: NOW,
			month: NOW,
			categoryId: "cat-1",
			updatedAt: NOW,
		});

		const props = await buildWidgetProps(db, NOW);

		expect(props.Ledger.entries.length).toBe(1);
		expect(props.Ledger.entries[0]?.amount).toBe("¥12,000");
	});

	it("leaves an entry in the ledger's own currency alone", async () => {
		const db = makeDb();
		await db.insert(transactions).values({
			id: "t1",
			amount: 18.5,
			income: false,
			currency: "USD",
			note: "Coffee",
			date: NOW,
			day: NOW,
			month: NOW,
			updatedAt: NOW,
		});

		const props = await buildWidgetProps(db, NOW);

		expect(props.Ledger.entries[0]?.amount).toBe("$18.50");
	});

	it("falls back to the ledger's currency when the entry named none", async () => {
		const db = makeDb();
		await db.insert(transactions).values({
			id: "t1",
			amount: 18.5,
			income: false,
			currency: null,
			note: "Coffee",
			date: NOW,
			day: NOW,
			month: NOW,
			updatedAt: NOW,
		});

		const props = await buildWidgetProps(db, NOW);

		expect(props.Ledger.entries[0]?.amount).toBe("$18.50");
	});
});

/**
 * A configured tile picks its own view out of the published props: the widget
 * body cannot query, so every selection has to be derived here whether or not
 * this install ever configures the tile.
 */
describe("the Budget widget's selections", () => {
	async function withBudgets(overall: boolean): Promise<SpendDb> {
		const db = makeDb();
		await db.insert(categories).values([
			{ id: "cat-1", name: "Food", income: false, updatedAt: NOW },
			{ id: "cat-2", name: "Transit", income: false, updatedAt: NOW },
		]);
		if (overall) {
			await db.insert(mainBudget).values({
				id: "main",
				name: "Overall Budget",
				amount: 1000,
				type: 3,
				startDate: new Date(Date.UTC(2026, 6, 1)),
				updatedAt: NOW,
			});
		}
		await db.insert(budgets).values([
			{
				id: "b-food",
				amount: 100,
				type: 3,
				startDate: new Date(Date.UTC(2026, 6, 1)),
				categoryId: "cat-1",
				updatedAt: NOW,
			},
			{
				id: "b-transit",
				amount: 100,
				type: 3,
				startDate: new Date(Date.UTC(2026, 6, 1)),
				categoryId: "cat-2",
				updatedAt: NOW,
			},
		]);
		await db.insert(transactions).values([
			{
				id: "t1",
				amount: 90,
				income: false,
				note: "Groceries",
				date: NOW,
				day: NOW,
				month: NOW,
				categoryId: "cat-1",
				updatedAt: NOW,
			},
			{
				id: "t2",
				amount: 10,
				income: false,
				note: "Bus",
				date: NOW,
				day: NOW,
				month: NOW,
				categoryId: "cat-2",
				updatedAt: NOW,
			},
		]);
		return db;
	}

	it("publishes the overall and the closest-to-its-limit budget side by side", async () => {
		const props = await buildWidgetProps(await withBudgets(true), NOW);

		expect(props.Budget.views.overall.name).toBe("Overall Budget");
		expect(props.Budget.views.worst.name).toBe("Food");
		// Unconfigured, the tile keeps showing what it always did.
		expect(props.Budget.views.auto).toStrictEqual(props.Budget.views.overall);
	});

	it("leaves the automatic view on the worst budget when there is no overall one", async () => {
		const props = await buildWidgetProps(await withBudgets(false), NOW);

		expect(props.Budget.views.overall.present).toBe(false);
		expect(props.Budget.views.auto).toStrictEqual(props.Budget.views.worst);
	});
});

describe("the Insights widget's windows", () => {
	it("publishes every period so a tile can be configured to one", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "insightsTimeFrame", value: "2" });

		const props = await buildWidgetProps(db, NOW);

		expect(Object.keys(props.Insights.windows).sort()).toStrictEqual([
			"month",
			"week",
			"year",
		]);
		expect(props.Insights.windows.week.periodLabel).toBe("THIS WEEK");
		expect(props.Insights.windows.year.periodLabel).toBe("THIS YEAR");
	});

	it("keeps the app's own period as what an unconfigured tile shows", async () => {
		const db = makeDb();
		await db.insert(appMeta).values({ key: "insightsTimeFrame", value: "3" });

		const props = await buildWidgetProps(db, NOW);

		expect(props.Insights.defaultPeriod).toBe("year");
	});
});
