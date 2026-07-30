import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { exchangeRates, transactions } from "@/db/schema";
import { RECURRING_TYPE } from "@/domain/recurrence";
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

describe("transactionsRepo.update and the replicated photo key", () => {
	const PHOTO = "file:///container/Documents/transaction-photos/a.jpg";
	const KEY = "transaction-photos/user-aaaa/a.jpg";

	async function photoColumns(db: Database, id: string) {
		const [row] = await db
			.select({
				imageUri: transactions.imageUri,
				imageKey: transactions.imageKey,
			})
			.from(transactions)
			.where(eq(transactions.id, id));
		return row;
	}

	it("clears the key when the user takes a visible photo off", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, { ...DRAFT, imageUri: PHOTO });
		await db
			.update(transactions)
			.set({ imageKey: KEY })
			.where(eq(transactions.id, id));

		await transactionsRepo.update(db, id, { ...DRAFT, imageUri: null });

		assert.deepEqual(await photoColumns(db, id), {
			imageUri: null,
			imageKey: null,
		});
	});

	it("keeps the key when the row's bytes have not reached this device", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, DRAFT);
		await db
			.update(transactions)
			.set({ imageKey: KEY })
			.where(eq(transactions.id, id));

		// Saving an unrelated edit on a row whose photo is still downloading must
		// not read as "the user removed the photo" — that would delete it account-wide.
		await transactionsRepo.update(db, id, { ...DRAFT, note: "Renamed" });

		assert.equal((await photoColumns(db, id)).imageKey, KEY);
	});

	it("keeps the superseded key when the photo is replaced, for the uploader to release", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, { ...DRAFT, imageUri: PHOTO });
		await db
			.update(transactions)
			.set({ imageKey: KEY })
			.where(eq(transactions.id, id));

		await transactionsRepo.update(db, id, {
			...DRAFT,
			imageUri: "file:///container/Documents/transaction-photos/b.jpg",
		});

		assert.equal((await photoColumns(db, id)).imageKey, KEY);
	});
});

describe("the reminder notice on a subscription", () => {
	const NOW = new Date(2026, 3, 1, 9, 0);
	const SUBSCRIPTION: TransactionInput = {
		amount: 12,
		income: false,
		categoryId: "cat-1",
		note: "Netflix",
		details: null,
		date: new Date(2026, 2, 15),
		currency: "USD",
		onceRecurring: true,
		recurringType: RECURRING_TYPE.monthly,
		recurringCoefficient: 1,
		reminderLeadDays: 3,
	};

	async function notices(db: Database) {
		return db
			.select({
				id: transactions.id,
				reminderLeadDays: transactions.reminderLeadDays,
				deletedAt: transactions.deletedAt,
			})
			.from(transactions);
	}

	it("hands the notice to the successor and clears it on the tombstone", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, SUBSCRIPTION);

		await transactionsRepo.remove(db, id, NOW);

		const rows = await notices(db);
		assert.equal(rows.find((row) => row.id === id)?.reminderLeadDays, null);
		const successor = rows.find((row) => row.id !== id);
		assert.equal(successor?.deletedAt, null);
		assert.equal(successor?.reminderLeadDays, 3);
	});

	it("clears the notice when the schedule is stopped", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, SUBSCRIPTION);

		await transactionsRepo.stopRecurring(db, id, NOW);

		const [row] = await notices(db);
		assert.equal(row?.reminderLeadDays, null);
	});

	it("writes no notice on a transaction that does not recur", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		const [row] = await notices(db);
		assert.equal(row?.id, id);
		assert.equal(row?.reminderLeadDays, null);
	});

	// A lead outside the picker's set reaches the row from a legacy or restored
	// input, and a stored negative would place the reminder *after* the charge.
	it("clamps a lead the picker would never offer", async () => {
		const db = makeDb();
		await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			reminderLeadDays: -4,
		});

		const [row] = await notices(db);
		assert.equal(row?.reminderLeadDays, 0);
	});

	it("keeps a same-day notice distinct from no notice", async () => {
		const db = makeDb();
		const sameDay = await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			reminderLeadDays: 0,
		});
		const off = await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			reminderLeadDays: undefined,
		});

		const rows = await notices(db);
		assert.equal(rows.find((row) => row.id === sameDay)?.reminderLeadDays, 0);
		assert.equal(rows.find((row) => row.id === off)?.reminderLeadDays, null);
	});

	// The form builds its input from the fields it paints, so an edit made on a
	// screen without a lead picker leaves the key out entirely.
	it("keeps the notice through an edit that never mentions it", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		const { reminderLeadDays: _absent, ...silentEdit } = SUBSCRIPTION;

		await transactionsRepo.update(db, id, { ...silentEdit, amount: 13 });

		const [row] = await notices(db);
		assert.equal(row?.reminderLeadDays, 3);
	});

	it("turns the notice off when an edit says null", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, SUBSCRIPTION);

		await transactionsRepo.update(db, id, {
			...SUBSCRIPTION,
			reminderLeadDays: null,
		});

		const [row] = await notices(db);
		assert.equal(row?.reminderLeadDays, null);
	});

	it("drops the notice when an edit ends the subscription", async () => {
		const db = makeDb();
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		const { reminderLeadDays: _absent, ...silentEdit } = SUBSCRIPTION;

		await transactionsRepo.update(db, id, {
			...silentEdit,
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		const [row] = await notices(db);
		assert.equal(row?.reminderLeadDays, null);
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
