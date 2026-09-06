import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";
import { eq, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { testDatabase } from "@/db/test-database";
import type { PendingWrite } from "@/lib/pending-writes-core";

import { applyPendingWrites, WALLET_DEDUPE_WINDOW_MS } from "./pending-writes-core";
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
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			currency text NOT NULL,
			kind text NOT NULL DEFAULT 'asset',
			icon text,
			emoji text,
			customColor text,
			imageColor text,
			imageUri text,
			imageKey text,
			initialBalance real NOT NULL DEFAULT 0,
			initialBalanceDate integer NOT NULL,
			initialBalanceUsd real,
			sortOrder integer NOT NULL DEFAULT 0,
			dateCreated integer NOT NULL,
			updatedAt integer NOT NULL,
			deletedAt integer
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
			recurringAnchorDay integer,
			reminderLeadDays integer,
			categoryId text,
			accountId text,
			amountUsd real,
			exchangeRate real,
			exchangeRateType text,
			transferId text,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
    return testDatabase(sqlite);
}

const NOW = new Date("2026-03-04T09:00:00Z");
const PURCHASE = "wallet:expense:blue bottle:640";

async function seedCategories(db: Database): Promise<void> {
    await db.insert(categories).values([
        {
            id: "cat-expense",
            income: false,
            name: "Coffee",
            sortOrder: 0,
            updatedAt: NOW,
        },
        {
            id: "cat-income",
            income: true,
            name: "Salary",
            sortOrder: 0,
            updatedAt: NOW,
        },
    ]);
}

function walletWrite(id: string, overrides: Partial<PendingWrite> = {}): PendingWrite {
    return {
        amount: 6.4,
        amountText: "$6.40",
        category: null,
        date: NOW.getTime(),
        dedupeKey: PURCHASE,
        id,
        income: false,
        note: "Blue Bottle",
        ...overrides,
    };
}

async function seedAccounts(db: Database): Promise<void> {
    await db.insert(accounts).values([
        {
            currency: "MXN",
            dateCreated: NOW,
            id: "acc-chase",
            initialBalanceDate: NOW,
            name: "Chase Sapphire",
            updatedAt: NOW,
        },
        {
            currency: "EUR",
            dateCreated: NOW,
            id: "acc-n26",
            initialBalanceDate: NOW,
            name: "N26",
            updatedAt: NOW,
        },
    ]);
}

async function liveRows(db: Database) {
    return db.select({ id: transactions.id, note: transactions.note }).from(transactions);
}

describe("applyPendingWrites", () => {
    let db: Database;

    beforeEach(async () => {
        db = makeDb();
        await seedCategories(db);
    });

    it("commits a queued entry through the repo", async () => {
        const applied = await applyPendingWrites(db, [walletWrite("a")], NOW);

        expect(applied).toBe(1);
        const rows = await liveRows(db);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.note).toBe("Blue Bottle");
    });

    it("collapses the authorize and settle runs of one purchase", async () => {
        await applyPendingWrites(db, [walletWrite("auth")], NOW);
        const settled = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS - 1);

        const applied = await applyPendingWrites(db, [walletWrite("settle")], settled);

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(1);
    });

    it("keeps the same purchase made again past the window", async () => {
        await applyPendingWrites(db, [walletWrite("morning")], NOW);
        const later = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS + 1);

        const applied = await applyPendingWrites(db, [walletWrite("noon")], later);

        expect(applied).toBe(1);
        await expect(liveRows(db)).resolves.toHaveLength(2);
    });

    it("keeps two purchases the automation could tell apart", async () => {
        await applyPendingWrites(db, [walletWrite("a")], NOW);

        const applied = await applyPendingWrites(db, [walletWrite("b", { dedupeKey: "wallet:id:txn-99" })], NOW);

        expect(applied).toBe(1);
        await expect(liveRows(db)).resolves.toHaveLength(2);
    });

    it("does not re-commit a replayed queue file", async () => {
        const job = walletWrite("replayed", { dedupeKey: null });

        await applyPendingWrites(db, [job], NOW);
        const applied = await applyPendingWrites(db, [job], NOW);

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(1);
    });

    it("does not re-commit a replayed file whose purchase key has aged out", async () => {
        const job = walletWrite("replayed");
        await applyPendingWrites(db, [job], NOW);
        const late = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS * 3);

        const applied = await applyPendingWrites(db, [job], late);

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(1);
    });

    it("lets a purchase the user deleted be logged again", async () => {
        await applyPendingWrites(db, [walletWrite("auth")], NOW);
        const [row] = await liveRows(db);
        expect(row).toBeTruthy();
        await transactionsRepo.remove(db, row.id, NOW);

        const applied = await applyPendingWrites(db, [walletWrite("again")], NOW);

        expect(applied).toBe(1);
        const live = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.deletedAt, NOW));
        expect(live).toHaveLength(1);
        await expect(liveRows(db)).resolves.toHaveLength(2);
    });

    it("files a merchant where it was filed last time", async () => {
        await db.insert(categories).values({
            id: "cat-eating-out",
            income: false,
            name: "Eating out",
            sortOrder: 1,
            updatedAt: NOW,
        });
        await db.insert(transactions).values({
            amount: 5,
            categoryId: "cat-eating-out",
            date: NOW,
            day: NOW,
            id: "old",
            income: false,
            month: NOW,
            note: "Blue Bottle",
            updatedAt: NOW,
        });

        await applyPendingWrites(db, [walletWrite("a")], NOW);

        const [row] = await db
            .select({ categoryId: transactions.categoryId })
            .from(transactions)
            .where(ne(transactions.id, "old"));
        expect(row?.categoryId).toBe("cat-eating-out");
    });

    it("reads the card's currency out of the formatted amount", async () => {
        await applyPendingWrites(db, [walletWrite("a", { amountText: "12,40 zł", dedupeKey: null })], NOW);

        const [row] = await db.select({ currency: transactions.currency }).from(transactions);
        expect(row?.currency).toBe("PLN");
    });

    it("files a Wallet purchase under the account its card matches", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { card: "Chase Sapphire Reserve" })], NOW);
        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBe("acc-chase");
    });

    it("leaves a purchase unattached when the card matches no account", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { card: "Apple Card" })], NOW);
        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBeNull();
    });

    it("takes the account's currency when the amount's symbol is ambiguous", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { amountText: "$6.40", card: "Chase Sapphire" })], NOW);
        const [row] = await db.select({ currency: transactions.currency }).from(transactions);
        expect(row?.currency).toBe("MXN");
    });

    it("keeps the amount's own currency over the account's", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { amountText: "12,40 zł", card: "N26" })], NOW);
        const [row] = await db.select({ currency: transactions.currency }).from(transactions);
        expect(row?.currency).toBe("PLN");
    });

    it("drops an entry with no category to file it under", async () => {
        await db.delete(categories);

        const applied = await applyPendingWrites(db, [walletWrite("a")], NOW);

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(0);
    });
});
