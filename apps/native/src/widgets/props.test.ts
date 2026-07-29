import assert from "node:assert/strict";
import { describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SpendDb } from "@/data/budget-spent";
import { categories, transactions } from "@/db/schema";
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

		assert.equal(props.Ledger.entries.length, 1);
		assert.equal(props.Ledger.entries[0]?.amount, "¥12,000");
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

		assert.equal(props.Ledger.entries[0]?.amount, "$18.50");
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

		assert.equal(props.Ledger.entries[0]?.amount, "$18.50");
	});
});
