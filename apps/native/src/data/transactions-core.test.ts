import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { exchangeRates, transactions } from "@/db/schema";
import {
	ledgerSizeQuery,
	type TransactionInput,
	transactionsRepo,
} from "./transactions-core";

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
	return drizzle(sqlite) as unknown as Database;
}

/** Older than the 90 days of history the rate feed serves. */
const LONG_AGO = new Date(Date.UTC(2020, 0, 1, 12));

const DRAFT: TransactionInput = {
	amount: 100,
	income: false,
	categoryId: "cat-1",
	note: "Bakery",
	details: null,
	date: LONG_AGO,
	currency: "EUR",
};

async function frozen(db: Database, id: string) {
	const [row] = await db
		.select({
			amount: transactions.amount,
			note: transactions.note,
			amountUsd: transactions.amountUsd,
			exchangeRate: transactions.exchangeRate,
			exchangeRateType: transactions.exchangeRateType,
		})
		.from(transactions)
		.where(eq(transactions.id, id));
	return row;
}

describe("transactionsRepo.update over a row the rates no longer reach", () => {
	let db: Database;
	let id: string;

	beforeEach(async () => {
		db = makeDb();
		await db.insert(exchangeRates).values({
			quote: "EUR",
			rateType: "official",
			date: "2020-01-01",
			rate: 0.9,
			source: "frankfurter",
			fetchedAt: LONG_AGO.getTime(),
		});
		id = await transactionsRepo.create(db, DRAFT);
		// `pullRatesIfDue` replaces the replica wholesale and the feed only serves
		// the last 90 days, so a row this old becomes unvaluable again.
		await db.delete(exchangeRates);
	});

	it("freezes the value at the rate of the day it happened", async () => {
		const row = await frozen(db, id);
		assert.equal(row.amountUsd, 111.111111);
		assert.equal(row.exchangeRate, 0.9);
		assert.equal(row.exchangeRateType, "official");
	});

	it("keeps that value when the edit leaves the money alone", async () => {
		await transactionsRepo.update(db, id, {
			...DRAFT,
			note: "Bakery, corner one",
		});

		const row = await frozen(db, id);
		assert.equal(row.note, "Bakery, corner one");
		assert.equal(row.amountUsd, 111.111111);
		assert.equal(row.exchangeRate, 0.9);
		assert.equal(row.exchangeRateType, "official");
	});

	it("declines to carry it onto an amount it no longer describes", async () => {
		await transactionsRepo.update(db, id, { ...DRAFT, amount: 200 });

		const row = await frozen(db, id);
		assert.equal(row.amount, 200);
		assert.equal(row.amountUsd, null);
		assert.equal(row.exchangeRate, null);
		assert.equal(row.exchangeRateType, null);
	});

	it("re-freezes a changed amount whenever the rate is back", async () => {
		await db.insert(exchangeRates).values({
			quote: "EUR",
			rateType: "official",
			date: "2020-01-01",
			rate: 0.9,
			source: "frankfurter",
			fetchedAt: LONG_AGO.getTime(),
		});

		await transactionsRepo.update(db, id, { ...DRAFT, amount: 200 });

		const row = await frozen(db, id);
		assert.equal(row.amountUsd, 222.222222);
		assert.equal(row.exchangeRate, 0.9);
	});
});

describe("ledgerSizeQuery", () => {
	it("counts only what a reader can still see", async () => {
		const db = makeDb();
		const now = new Date();
		await db.insert(transactions).values([
			{
				id: "live",
				amount: 10,
				income: false,
				note: "",
				date: now,
				day: now,
				month: now,
				updatedAt: now,
			},
			{
				id: "tombstoned",
				amount: 10,
				income: false,
				note: "",
				date: now,
				day: now,
				month: now,
				updatedAt: now,
				deletedAt: now,
			},
		]);

		const rows = await ledgerSizeQuery(db);
		assert.deepEqual(
			rows.map((row) => row.id),
			["live"],
		);
	});
});
