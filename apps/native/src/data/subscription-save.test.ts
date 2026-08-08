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
		// `toMatchObject` rather than `.rejects.toThrow()`: better-sqlite3's
		// `SqliteError` is a native-addon class, and Jest gives each test file its
		// own realm, so `instanceof Error` on it is not reliable across files —
		// `toThrow()` silently reports "did not throw" when that happens.
		await expect(backfillRecurring(db, id, NOW)).rejects.toMatchObject({
			message: expect.stringMatching(/exchangeRates/),
		});

		const live = await carriers(db);
		expect(live.length).toBe(1);
		expect(live[0]?.id).toBe(id);
	});

	it("writes no charges, so the source is the whole ledger", async () => {
		const { db, breakRateReplica } = harness;
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		breakRateReplica();

		await expect(backfillRecurring(db, id, NOW)).rejects.toMatchObject({
			message: expect.any(String),
		});

		const rows = await liveRows(db);
		expect(rows.length).toBe(1);
		expect(rows[0]?.id).toBe(id);
	});

	// What makes the "Outlayr will try again the next time you open it" wording
	// honest: the schedule is still on the row, so the foreground sweep picks the
	// chain up. A back-fill that had retired the source on its way out would leave
	// the subscription silently settled after one charge.
	it("leaves the schedule live for the next sweep to walk", async () => {
		const { db, breakRateReplica } = harness;
		const id = await transactionsRepo.create(db, SUBSCRIPTION);
		breakRateReplica();

		await expect(backfillRecurring(db, id, NOW)).rejects.toMatchObject({
			message: expect.any(String),
		});

		const [source] = await liveRows(db);
		expect(source?.recurringType).toBe(RECURRING_TYPE.monthly);
		expect(source?.recurringCoefficient).toBe(1);
		expect(source?.onceRecurring).toBe(true);
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

		expect(first).not.toBe(second);
		expect((await carriers(db)).length).toBe(2);
	});
});

describe("the day a saved schedule is anchored to", () => {
	let harness: Harness;
	beforeEach(() => {
		harness = makeDb();
	});

	it("stamps a subscription with its first payment's day of the month", async () => {
		const { db } = harness;

		const id = await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			date: new Date(2025, 0, 31),
		});

		const [row] = await liveRows(db);
		expect(row?.id).toBe(id);
		expect(row?.recurringAnchorDay).toBe(31);
	});

	it("leaves a one-off unanchored — it has no schedule to hold onto", async () => {
		const { db } = harness;

		await transactionsRepo.create(db, {
			...SUBSCRIPTION,
			date: new Date(2025, 0, 31),
			onceRecurring: false,
			recurringType: RECURRING_TYPE.none,
		});

		const [row] = await liveRows(db);
		expect(row?.recurringAnchorDay).toBe(null);
	});
});
