import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { getTableColumns, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import {
	budgets,
	categories,
	mainBudget,
	templateTransactions,
	transactions,
} from "@/db/schema";
import { ERASED_TRANSACTION, eraseLedger } from "./erase-core";
import { deletedTransactionsQuery } from "./transactions-core";

function makeDb(): Database {
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
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
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
			currency text,
			amountUsd real,
			green integer NOT NULL DEFAULT 0,
			rollover integer NOT NULL DEFAULT 0,
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
			currency text,
			amountUsd real,
			green integer NOT NULL DEFAULT 0,
			rollover integer NOT NULL DEFAULT 0,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE templateTransactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			note text,
			sortOrder integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			categoryId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

const AUTHORED = new Date("2026-03-04T10:00:00.000Z");

async function seed(db: Database): Promise<void> {
	await db.insert(categories).values({
		id: "cat-1",
		name: "Coffee",
		icon: "Coffee02",
		color: "#279AF4",
		income: false,
		dateCreated: AUTHORED,
		updatedAt: AUTHORED,
	});
	await db.insert(transactions).values({
		id: "tx-1",
		amount: 42.5,
		income: false,
		currency: "EUR",
		note: "Flat white with Marta",
		details: "corner cafe",
		date: AUTHORED,
		day: AUTHORED,
		month: AUTHORED,
		icon: "Coffee02",
		emoji: "☕️",
		customColor: "#112233",
		imageColor: "#445566",
		imageUri: "file:///photos/tx-1.jpg",
		onceRecurring: true,
		recurringType: 2,
		recurringCoefficient: 3,
		recurringEndDate: AUTHORED,
		reminderLeadDays: 3,
		categoryId: "cat-1",
		amountUsd: 46.2,
		exchangeRate: 1.087,
		exchangeRateType: "official",
		updatedAt: AUTHORED,
	});
	await db.insert(templateTransactions).values({
		id: "tpl-1",
		amount: 9.99,
		income: false,
		note: "Streaming",
		sortOrder: 4,
		recurringType: 3,
		recurringCoefficient: 2,
		categoryId: "cat-1",
		updatedAt: AUTHORED,
	});
	await db.insert(budgets).values({
		id: "bud-1",
		name: "Coffee cap",
		amount: 100,
		type: 2,
		startDate: AUTHORED,
		dateCreated: AUTHORED,
		currency: "EUR",
		amountUsd: 108.7,
		green: true,
		categoryId: "cat-1",
		updatedAt: AUTHORED,
	});
	await db.insert(mainBudget).values({
		id: "main-1",
		name: "Everything",
		amount: 2000,
		type: 3,
		startDate: AUTHORED,
		dateCreated: AUTHORED,
		currency: "EUR",
		amountUsd: 2174,
		green: false,
		updatedAt: AUTHORED,
	});
}

describe("eraseLedger", () => {
	let db: Database;
	beforeEach(async () => {
		db = makeDb();
		await seed(db);
	});

	it("leaves no readable transaction but keeps a replicable tombstone", async () => {
		await eraseLedger(db, "transactions");

		const readable = await db
			.select()
			.from(transactions)
			.where(isNull(transactions.deletedAt));
		assert.equal(readable.length, 0);

		const replicable = await db.select().from(transactions);
		assert.equal(replicable.length, 1);
		assert.equal(replicable[0].id, "tx-1");
		assert.notEqual(replicable[0].deletedAt, null);
	});

	// Recently Deleted is the one screen built to read tombstones, so an erase
	// writes straight into it: without the exclusion the user is handed the ledger
	// they just erased back, row by row, each with a Restore button.
	it("keeps the rows it erased out of Recently Deleted", async () => {
		const removed = new Date("2026-02-01T00:00:00.000Z");
		await db.insert(transactions).values({
			id: "tx-2",
			amount: 7,
			income: false,
			note: "already gone",
			date: AUTHORED,
			day: AUTHORED,
			month: AUTHORED,
			updatedAt: removed,
			deletedAt: removed,
		});

		await eraseLedger(db, "transactions");

		assert.deepEqual(
			(await deletedTransactionsQuery(db)).map((row) => row.id),
			["tx-2"],
		);
	});

	// A column added to `transactions` and not to the constant would survive the
	// erase on the tombstone, and no round-trip assertion above would notice.
	it("names every column of a transaction that is not the envelope", () => {
		const ENVELOPE = new Set(["id", "updatedAt", "deletedAt"]);
		const declared = Object.keys(getTableColumns(transactions)).filter(
			(name) => !ENVELOPE.has(name),
		);

		assert.deepEqual(Object.keys(ERASED_TRANSACTION).sort(), declared.sort());
	});

	it("strips everything personal off a transaction tombstone", async () => {
		await eraseLedger(db, "transactions");

		const [row] = await db.select().from(transactions);
		assert.equal(row.amount, 0);
		assert.equal(row.income, false);
		assert.equal(row.currency, null);
		assert.equal(row.note, "");
		assert.equal(row.details, null);
		assert.equal(row.date.getTime(), 0);
		assert.equal(row.day.getTime(), 0);
		assert.equal(row.month.getTime(), 0);
		assert.equal(row.icon, null);
		assert.equal(row.emoji, null);
		assert.equal(row.customColor, null);
		assert.equal(row.imageColor, null);
		assert.equal(row.imageUri, null);
		assert.equal(row.onceRecurring, false);
		assert.equal(row.recurringType, 0);
		assert.equal(row.recurringCoefficient, 1);
		assert.equal(row.recurringEndDate, null);
		assert.equal(row.reminderLeadDays, null);
		assert.equal(row.categoryId, null);
		assert.equal(row.amountUsd, null);
		assert.equal(row.exchangeRate, null);
		assert.equal(row.exchangeRateType, null);
	});

	it("strips everything personal off a template tombstone", async () => {
		await eraseLedger(db, "transactions");

		const readable = await db
			.select()
			.from(templateTransactions)
			.where(isNull(templateTransactions.deletedAt));
		assert.equal(readable.length, 0);

		const [row] = await db.select().from(templateTransactions);
		assert.equal(row.id, "tpl-1");
		assert.notEqual(row.deletedAt, null);
		assert.equal(row.amount, 0);
		assert.equal(row.income, false);
		assert.equal(row.note, null);
		assert.equal(row.sortOrder, 0);
		assert.equal(row.recurringType, 0);
		assert.equal(row.recurringCoefficient, 1);
		assert.equal(row.categoryId, null);
	});

	it("keeps budgets live under the transactions scope", async () => {
		await eraseLedger(db, "transactions");

		const liveBudgets = await db
			.select()
			.from(budgets)
			.where(isNull(budgets.deletedAt));
		assert.equal(liveBudgets.length, 1);
		const liveMain = await db
			.select()
			.from(mainBudget)
			.where(isNull(mainBudget.deletedAt));
		assert.equal(liveMain.length, 1);
	});

	it("strips everything personal off budget tombstones", async () => {
		await eraseLedger(db, "everything");

		const [budget] = await db.select().from(budgets);
		assert.notEqual(budget.deletedAt, null);
		assert.equal(budget.name, null);
		assert.equal(budget.amount, 0);
		assert.equal(budget.type, 0);
		assert.equal(budget.startDate, null);
		assert.equal(budget.dateCreated, null);
		assert.equal(budget.currency, null);
		assert.equal(budget.amountUsd, null);
		assert.equal(budget.green, false);
		assert.equal(budget.categoryId, null);

		const [main] = await db.select().from(mainBudget);
		assert.notEqual(main.deletedAt, null);
		assert.equal(main.name, null);
		assert.equal(main.amount, 0);
		assert.equal(main.type, 0);
		assert.equal(main.startDate, null);
		assert.equal(main.dateCreated, null);
		assert.equal(main.currency, null);
		assert.equal(main.amountUsd, null);
		assert.equal(main.green, false);
	});

	it("frees the category so a new budget can be attached to it", async () => {
		await eraseLedger(db, "everything");

		const now = new Date();
		await db.insert(budgets).values({
			id: "bud-2",
			amount: 50,
			type: 2,
			categoryId: "cat-1",
			green: false,
			updatedAt: now,
		});
		const live = await db
			.select()
			.from(budgets)
			.where(isNull(budgets.deletedAt));
		assert.equal(live.length, 1);
		assert.equal(live[0].id, "bud-2");
	});

	it("keeps categories untouched under either scope", async () => {
		await eraseLedger(db, "everything");

		const live = await db
			.select()
			.from(categories)
			.where(isNull(categories.deletedAt));
		assert.equal(live.length, 1);
		assert.equal(live[0].name, "Coffee");
		assert.equal(live[0].updatedAt.getTime(), AUTHORED.getTime());
	});

	it("does not re-stamp a tombstone it already wrote", async () => {
		await eraseLedger(db, "everything");
		const first = await db.select().from(transactions);
		const firstBudget = await db.select().from(budgets);

		await eraseLedger(db, "everything");

		const second = await db.select().from(transactions);
		assert.equal(second.length, 1);
		assert.equal(second[0].deletedAt?.getTime(), first[0].deletedAt?.getTime());
		assert.equal(second[0].updatedAt.getTime(), first[0].updatedAt.getTime());

		const secondBudget = await db.select().from(budgets);
		assert.equal(
			secondBudget[0].updatedAt.getTime(),
			firstBudget[0].updatedAt.getTime(),
		);
	});

	it("leaves a row another path already tombstoned alone", async () => {
		const removed = new Date("2026-02-01T00:00:00.000Z");
		await db.insert(transactions).values({
			id: "tx-2",
			amount: 7,
			income: false,
			note: "already gone",
			date: AUTHORED,
			day: AUTHORED,
			month: AUTHORED,
			updatedAt: removed,
			deletedAt: removed,
		});

		await eraseLedger(db, "transactions");

		const rows = await db.select().from(transactions);
		const survivor = rows.find((row) => row.id === "tx-2");
		assert.equal(survivor?.deletedAt?.getTime(), removed.getTime());
		assert.equal(survivor?.updatedAt.getTime(), removed.getTime());
		assert.equal(survivor?.note, "already gone");
	});
});
