import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { asc, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { backfillRecurring } from "./recurrence-backfill";
import { type TransactionInput, transactionsRepo } from "./transactions-core";

const NOW = new Date(2025, 5, 15, 10, 30);

/**
 * The two writes the transaction form runs for a subscription, in order:
 * `create` COMMITS, and only then does the back-fill walk the schedule forward.
 * Everything here is about what the ledger holds when the second one fails.
 */
const SUBSCRIPTION: TransactionInput = {
	amount: 9.99,
	income: false,
	categoryId: "bills",
	note: "Netflix",
	details: null,
	date: new Date(2025, 2, 15),
	// Foreign on purpose: a USD amount is canonical by definition and never
	// consults the rate replica, so nothing would read the table these tests pull
	// out from under the back-fill.
	currency: "EUR",
	onceRecurring: true,
	recurringType: RECURRING_TYPE.monthly,
	recurringCoefficient: 1,
	recurringEndDate: null,
	reminderLeadDays: null,
};

interface Harness {
	db: Database;
	/**
	 * Drops the rate replica, so the back-fill's per-occurrence rate lookups fail
	 * — the real failure site, reached after the source row is already committed
	 * and before the write transaction that would retire it.
	 */
	breakRateReplica: () => void;
}

function makeDb(): Harness {
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
	return {
		db: drizzle(sqlite) as unknown as Database,
		breakRateReplica: () => sqlite.exec("DROP TABLE exchangeRates;"),
	};
}

function liveRows(db: Database) {
	return db
		.select()
		.from(transactions)
		.where(isNull(transactions.deletedAt))
		.orderBy(asc(transactions.date));
}

async function carriers(db: Database) {
	const rows = await liveRows(db);
	return rows.filter((row) => row.recurringType !== RECURRING_TYPE.none);
}

describe("a subscription whose back-fill fails after the row is committed", () => {
	let harness: Harness;
	beforeEach(() => {
		harness = makeDb();
	});

	it("holds exactly one live schedule, not one per attempt", async () => {
		const { db, breakRateReplica } = harness;
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		breakRateReplica();

		// Asserted on the message so the injected fault stays the intended one: a
		// back-fill that resolved here would be proving nothing about a failure.
		await assert.rejects(() => backfillRecurring(db, id, NOW), /exchangeRates/);

		const live = await carriers(db);
		assert.equal(live.length, 1);
		assert.equal(live[0]?.id, id);
	});

	it("writes no charges, so the source is the whole ledger", async () => {
		const { db, breakRateReplica } = harness;
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		breakRateReplica();

		await assert.rejects(() => backfillRecurring(db, id, NOW));

		const rows = await liveRows(db);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.id, id);
	});

	// What makes the "Outlayr will try again the next time you open it" wording
	// honest: the schedule is still on the row, so the foreground sweep picks the
	// chain up. A back-fill that had retired the source on its way out would leave
	// the subscription silently settled after one charge.
	it("leaves the schedule live for the next sweep to walk", async () => {
		const { db, breakRateReplica } = harness;
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		breakRateReplica();

		await assert.rejects(() => backfillRecurring(db, id, NOW));

		const [source] = await liveRows(db);
		assert.equal(source?.recurringType, RECURRING_TYPE.monthly);
		assert.equal(source?.recurringCoefficient, 1);
		assert.equal(source?.onceRecurring, true);
	});

	// The fault the form's post-failure state exists to prevent: `create` mints a
	// fresh id every call, so re-tapping the CTA after a committed row does not
	// rewrite that row — it adds a second subscription, and the next sweep then
	// walks BOTH forward into their own chains of charges. Hence the save path
	// dismisses the form on a back-fill failure instead of re-enabling the button.
	it("would double up if the same save ran twice", async () => {
		const { db } = harness;

		const first = await transactionsRepo.create(db, SUBSCRIPTION);
		const second = await transactionsRepo.create(db, SUBSCRIPTION);

		assert.notEqual(first, second);
		assert.equal((await carriers(db)).length, 2);
	});
});
