import { act, renderHook, waitFor } from "@testing-library/react-native";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions, transfers } from "@/db/schema";
import { firstOfMonth, startOfDay } from "@/domain/dates";
import { accountsRepo } from "./accounts-core";
import { transfersRepo } from "./transfers-core";
import { useDeferredDelete } from "./use-deferred-delete";

const DAY = new Date(Date.UTC(2026, 7, 9));

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	sqlite.exec(`
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			currency text NOT NULL,
			initialBalance real DEFAULT 0 NOT NULL,
			initialBalanceUsd real,
			initialBalanceDate integer NOT NULL,
			icon text, emoji text, customColor text, imageColor text, imageUri text, imageKey text,
			sortOrder integer DEFAULT 0 NOT NULL,
			dateCreated integer NOT NULL,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transactions (
			id text PRIMARY KEY NOT NULL,
			amount real NOT NULL,
			income integer NOT NULL,
			currency text,
			note text NOT NULL DEFAULT '',
			details text, icon text, emoji text, customColor text, imageColor text, imageUri text, imageKey text,
			onceRecurring integer NOT NULL DEFAULT 0,
			recurringType integer NOT NULL DEFAULT 0,
			recurringCoefficient integer NOT NULL DEFAULT 1,
			recurringEndDate integer, recurringAnchorDay integer, reminderLeadDays integer,
			date integer NOT NULL, day integer NOT NULL, month integer NOT NULL,
			categoryId text, accountId text, amountUsd real, exchangeRate real, exchangeRateType text,
			transferId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
		CREATE TABLE transfers (
			id text PRIMARY KEY NOT NULL,
			fromAccountId text NOT NULL, toAccountId text NOT NULL,
			fromAmount real NOT NULL, fromCurrency text NOT NULL, fromAmountUsd real,
			toAmount real NOT NULL, toCurrency text NOT NULL, toAmountUsd real,
			exchangeRate real, exchangeRateType text,
			date integer NOT NULL, day integer NOT NULL, month integer NOT NULL,
			note text DEFAULT '' NOT NULL,
			dateCreated integer NOT NULL, updatedAt integer NOT NULL, deletedAt integer
		);
		CREATE TABLE exchangeRates (
			quote text NOT NULL, rateType text NOT NULL, date text NOT NULL, rate real NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
	`);
	return drizzle(sqlite) as unknown as Database;
}

async function transferWithFee(db: Database): Promise<string> {
	const from = await accountsRepo.create(db, { currency: "USD", name: "Zinli" });
	const to = await accountsRepo.create(db, { currency: "USD", name: "Banesco" });
	return await transfersRepo.create(db, {
		date: DAY,
		exchangeRate: null,
		exchangeRateType: null,
		fee: { amount: 2.5, categoryId: "cat-fees", side: "source" },
		fromAccountId: from,
		fromAmount: 100,
		fromCurrency: "USD",
		toAccountId: to,
		toAmount: 100,
		toCurrency: "USD",
	});
}

async function plainTransaction(db: Database): Promise<string> {
	const now = new Date();
	await db.insert(transactions).values({
		amount: 12,
		date: DAY,
		day: startOfDay(DAY),
		id: "tx-1",
		income: false,
		month: firstOfMonth(DAY),
		note: "Coffee",
		updatedAt: now,
	});
	return "tx-1";
}

/** Unmounting flushes whatever is still inside its undo window, so no clock has to be cranked. */
async function deleteAndCommit(db: Database, id: string) {
	const { result, unmount } = await renderHook(() => useDeferredDelete(db));
	await act(async () => {
		result.current.requestDelete(id);
	});
	await unmount();
}

describe("useDeferredDelete", () => {
	it("takes a transfer out through the transfers repo without being told it is one, tombstoning its fee with it", async () => {
		const db = makeDb();
		const id = await transferWithFee(db);

		await deleteAndCommit(db, id);

		await waitFor(async () => {
			const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id));
			expect(transfer.deletedAt).not.toBeNull();
		});
		const [fee] = await db.select().from(transactions).where(eq(transactions.transferId, id));
		expect(fee.deletedAt).not.toBeNull();
	});

	it("still takes an ordinary transaction out through the transactions repo", async () => {
		const db = makeDb();
		const id = await plainTransaction(db);

		await deleteAndCommit(db, id);

		await waitFor(async () => {
			const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
			expect(row.deletedAt).not.toBeNull();
		});
	});
});
