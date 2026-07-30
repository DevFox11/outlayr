import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { exchangeRates, outbox, transactions } from "@/db/schema";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { setSyncEnabled } from "./sync-outbox-core";
import {
	deletedTransactionsQuery,
	ledgerSizeQuery,
	logWindowDaysQuery,
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

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

/**
 * The hand-rolled schema above carries no outbox and no triggers, so anything
 * that has to prove a write reaches the account is run against the shipped
 * migrations instead.
 */
function syncedDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	const files = readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort();
	for (const file of files) {
		const sql = readFileSync(join(MIGRATIONS, file), "utf8");
		for (const statement of sql.split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	// The shipped schema enforces the category foreign key the inline one above
	// leaves off, so the category every draft here names has to exist.
	sqlite
		.prepare(
			"INSERT INTO categories (id, name, income, sortOrder, updatedAt) VALUES ('cat-1', 'Groceries', 0, 0, 1)",
		)
		.run();
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

describe("restoring a tombstoned transaction", () => {
	const DELETED_AT = new Date(2026, 3, 1, 9, 0);
	const RESTORED_AT = new Date(2026, 3, 2, 8, 30);
	const LATER_STILL = new Date(2026, 3, 3, 8, 30);

	async function timestamps(db: Database, id: string) {
		const [row] = await db
			.select({
				deletedAt: transactions.deletedAt,
				updatedAt: transactions.updatedAt,
				recurringType: transactions.recurringType,
				reminderLeadDays: transactions.reminderLeadDays,
			})
			.from(transactions)
			.where(eq(transactions.id, id));
		return row;
	}

	let db: Database;
	let id: string;

	beforeEach(async () => {
		db = makeDb();
		id = await transactionsRepo.create(db, DRAFT);
		await transactionsRepo.remove(db, id, DELETED_AT);
	});

	it("puts the entry back in every read that hides tombstones", async () => {
		assert.deepEqual(await ledgerSizeQuery(db), []);

		await transactionsRepo.restore(db, id, RESTORED_AT);

		assert.deepEqual(
			(await ledgerSizeQuery(db)).map((row) => row.id),
			[id],
		);
		assert.equal((await logWindowDaysQuery(db, Date.now(), 30)).length, 1);
	});

	it("takes the entry off the deleted list it was restored from", async () => {
		assert.deepEqual(
			(await deletedTransactionsQuery(db)).map((row) => row.id),
			[id],
		);

		await transactionsRepo.restore(db, id, RESTORED_AT);

		assert.deepEqual(await deletedTransactionsQuery(db), []);
	});

	it("moves updatedAt, so a peer is told the row came back", async () => {
		await transactionsRepo.restore(db, id, RESTORED_AT);

		const row = await timestamps(db, id);
		assert.equal(row?.deletedAt, null);
		assert.equal(row?.updatedAt.getTime(), RESTORED_AT.getTime());
	});

	it("writes nothing the second time, so a restore is idempotent", async () => {
		await transactionsRepo.restore(db, id, RESTORED_AT);
		await transactionsRepo.restore(db, id, LATER_STILL);

		assert.equal(
			(await timestamps(db, id))?.updatedAt.getTime(),
			RESTORED_AT.getTime(),
		);
	});

	it("leaves a subscription the delete ended ended", async () => {
		const carrier = await transactionsRepo.create(db, {
			...DRAFT,
			onceRecurring: true,
			recurringType: RECURRING_TYPE.monthly,
			recurringCoefficient: 1,
			reminderLeadDays: 3,
		});
		await transactionsRepo.remove(db, carrier, DELETED_AT);

		await transactionsRepo.restore(db, carrier, RESTORED_AT);

		const row = await timestamps(db, carrier);
		assert.equal(row?.recurringType, RECURRING_TYPE.none);
		assert.equal(row?.reminderLeadDays, null);
	});
});

describe("a restore the account has to hear about", () => {
	const DELETED_AT = new Date(2026, 3, 1, 9, 0);
	const RESTORED_AT = new Date(2026, 3, 2, 8, 30);
	const LATER_STILL = new Date(2026, 3, 3, 8, 30);

	async function queued(db: Database) {
		return db
			.select({
				seq: outbox.seq,
				tableName: outbox.tableName,
				localId: outbox.localId,
			})
			.from(outbox);
	}

	it("queues the row it brought back", async () => {
		const db = syncedDb();
		const id = await transactionsRepo.create(db, DRAFT);
		await transactionsRepo.remove(db, id, DELETED_AT);
		// Only after the tombstone, so the queue holds the restore and nothing else.
		await setSyncEnabled(db, true);

		await transactionsRepo.restore(db, id, RESTORED_AT);

		assert.deepEqual(
			(await queued(db)).map((row) => [row.tableName, row.localId]),
			[["transactions", id]],
		);
	});

	it("queues nothing for a restore that had nothing to lift", async () => {
		const db = syncedDb();
		const id = await transactionsRepo.create(db, DRAFT);
		await transactionsRepo.remove(db, id, DELETED_AT);
		await setSyncEnabled(db, true);
		await transactionsRepo.restore(db, id, RESTORED_AT);
		const first = (await queued(db))[0]?.seq;

		await transactionsRepo.restore(db, id, LATER_STILL);

		// A fresh seq would mean a second write went out saying nothing at all.
		assert.equal((await queued(db))[0]?.seq, first);
	});
});

describe("switching sync off over a ledger already logged", () => {
	const DELETED_AT = new Date(2026, 3, 1, 9, 0);

	it("stops the queue without taking a row off this device", async () => {
		const db = syncedDb();
		await setSyncEnabled(db, true);
		const kept = await transactionsRepo.create(db, DRAFT);
		const tombstoned = await transactionsRepo.create(db, DRAFT);
		await transactionsRepo.remove(db, tombstoned, DELETED_AT);

		await setSyncEnabled(db, false);
		const afterOff = await transactionsRepo.create(db, DRAFT);

		assert.deepEqual(await db.select({ seq: outbox.seq }).from(outbox), []);
		assert.deepEqual(
			(await ledgerSizeQuery(db)).map((row) => row.id).sort(),
			[kept, afterOff].sort(),
		);
		assert.deepEqual(
			(await deletedTransactionsQuery(db)).map((row) => row.id),
			[tombstoned],
		);
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
