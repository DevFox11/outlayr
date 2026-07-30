import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import type { PendingWrite } from "@/lib/pending-writes-core";
import {
	applyPendingWrites,
	WALLET_DEDUPE_WINDOW_MS,
} from "./pending-writes-core";
import { transactionsRepo } from "./transactions-core";

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
	`);
	return drizzle(sqlite) as unknown as Database;
}

const NOW = new Date("2026-03-04T09:00:00Z");
const PURCHASE = "wallet:expense:blue bottle:640";

async function seedCategories(db: Database): Promise<void> {
	await db.insert(categories).values([
		{
			id: "cat-expense",
			name: "Coffee",
			income: false,
			sortOrder: 0,
			updatedAt: NOW,
		},
		{
			id: "cat-income",
			name: "Salary",
			income: true,
			sortOrder: 0,
			updatedAt: NOW,
		},
	]);
}

function walletWrite(
	id: string,
	overrides: Partial<PendingWrite> = {},
): PendingWrite {
	return {
		id,
		amount: 6.4,
		income: false,
		note: "Blue Bottle",
		category: null,
		date: NOW.getTime(),
		amountText: "$6.40",
		dedupeKey: PURCHASE,
		...overrides,
	};
}

async function liveRows(db: Database) {
	return db
		.select({ id: transactions.id, note: transactions.note })
		.from(transactions);
}

describe("applyPendingWrites", () => {
	let db: Database;

	beforeEach(async () => {
		db = makeDb();
		await seedCategories(db);
	});

	it("commits a queued entry through the repo", async () => {
		const applied = await applyPendingWrites(db, [walletWrite("a")], NOW);

		assert.equal(applied, 1);
		const rows = await liveRows(db);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.note, "Blue Bottle");
	});

	it("collapses the authorize and settle runs of one purchase", async () => {
		await applyPendingWrites(db, [walletWrite("auth")], NOW);
		const settled = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS - 1);

		const applied = await applyPendingWrites(
			db,
			[walletWrite("settle")],
			settled,
		);

		assert.equal(applied, 0);
		assert.equal((await liveRows(db)).length, 1);
	});

	it("keeps the same purchase made again past the window", async () => {
		await applyPendingWrites(db, [walletWrite("morning")], NOW);
		const later = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS + 1);

		const applied = await applyPendingWrites(db, [walletWrite("noon")], later);

		assert.equal(applied, 1);
		assert.equal((await liveRows(db)).length, 2);
	});

	it("keeps two purchases the automation could tell apart", async () => {
		await applyPendingWrites(db, [walletWrite("a")], NOW);

		const applied = await applyPendingWrites(
			db,
			[walletWrite("b", { dedupeKey: "wallet:id:txn-99" })],
			NOW,
		);

		assert.equal(applied, 1);
		assert.equal((await liveRows(db)).length, 2);
	});

	it("does not re-commit a replayed queue file", async () => {
		const job = walletWrite("replayed", { dedupeKey: null });

		await applyPendingWrites(db, [job], NOW);
		const applied = await applyPendingWrites(db, [job], NOW);

		assert.equal(applied, 0);
		assert.equal((await liveRows(db)).length, 1);
	});

	it("does not re-commit a replayed file whose purchase key has aged out", async () => {
		const job = walletWrite("replayed");
		await applyPendingWrites(db, [job], NOW);
		const late = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS * 3);

		const applied = await applyPendingWrites(db, [job], late);

		assert.equal(applied, 0);
		assert.equal((await liveRows(db)).length, 1);
	});

	it("lets a purchase the user deleted be logged again", async () => {
		await applyPendingWrites(db, [walletWrite("auth")], NOW);
		const [row] = await liveRows(db);
		assert.ok(row);
		await transactionsRepo.remove(db, row.id, NOW);

		const applied = await applyPendingWrites(db, [walletWrite("again")], NOW);

		assert.equal(applied, 1);
		const live = await db
			.select({ id: transactions.id })
			.from(transactions)
			.where(eq(transactions.deletedAt, NOW));
		assert.equal(live.length, 1);
		assert.equal((await liveRows(db)).length, 2);
	});

	it("files a merchant where it was filed last time", async () => {
		await db.insert(categories).values({
			id: "cat-eating-out",
			name: "Eating out",
			income: false,
			sortOrder: 1,
			updatedAt: NOW,
		});
		await db.insert(transactions).values({
			id: "old",
			amount: 5,
			income: false,
			note: "Blue Bottle",
			date: NOW,
			day: NOW,
			month: NOW,
			categoryId: "cat-eating-out",
			updatedAt: NOW,
		});

		await applyPendingWrites(db, [walletWrite("a")], NOW);

		const [row] = await db
			.select({ categoryId: transactions.categoryId })
			.from(transactions)
			.where(ne(transactions.id, "old"));
		assert.equal(row?.categoryId, "cat-eating-out");
	});

	it("reads the card's currency out of the formatted amount", async () => {
		await applyPendingWrites(
			db,
			[walletWrite("a", { amountText: "12,40 zł", dedupeKey: null })],
			NOW,
		);

		const [row] = await db
			.select({ currency: transactions.currency })
			.from(transactions);
		assert.equal(row?.currency, "PLN");
	});

	it("drops an entry with no category to file it under", async () => {
		await db.delete(categories);

		const applied = await applyPendingWrites(db, [walletWrite("a")], NOW);

		assert.equal(applied, 0);
		assert.equal((await liveRows(db)).length, 0);
	});
});
