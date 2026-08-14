import BetterSqlite3 from "better-sqlite3";
import { getTableColumns, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { budgets, categories, mainBudget, transactions } from "@/db/schema";

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
		CREATE TABLE transfers (
			id text PRIMARY KEY NOT NULL,
			fromAccountId text NOT NULL,
			toAccountId text NOT NULL,
			fromAmount real NOT NULL,
			fromCurrency text NOT NULL,
			fromAmountUsd real,
			toAmount real NOT NULL,
			toCurrency text NOT NULL,
			toAmountUsd real,
			exchangeRate real,
			exchangeRateType text,
			date integer NOT NULL,
			day integer NOT NULL,
			month integer NOT NULL,
			note text DEFAULT '' NOT NULL,
			dateCreated integer NOT NULL,
			updatedAt integer NOT NULL,
			deletedAt integer
		);
	`);
    return drizzle(sqlite) as unknown as Database;
}

const AUTHORED = new Date("2026-03-04T10:00:00.000Z");

async function seed(db: Database): Promise<void> {
    await db.insert(categories).values({
        color: "#279AF4",
        dateCreated: AUTHORED,
        icon: "Coffee02",
        id: "cat-1",
        income: false,
        name: "Coffee",
        updatedAt: AUTHORED,
    });
    await db.insert(transactions).values({
        accountId: "acct-1",
        amount: 42.5,
        amountUsd: 46.2,
        categoryId: "cat-1",
        currency: "EUR",
        customColor: "#112233",
        date: AUTHORED,
        day: AUTHORED,
        details: "corner cafe",
        emoji: "☕️",
        exchangeRate: 1.087,
        exchangeRateType: "official",
        icon: "Coffee02",
        id: "tx-1",
        imageColor: "#445566",
        imageUri: "file:///photos/tx-1.jpg",
        income: false,
        month: AUTHORED,
        note: "Flat white with Marta",
        onceRecurring: true,
        recurringCoefficient: 3,
        recurringEndDate: AUTHORED,
        recurringType: 2,
        reminderLeadDays: 3,
        updatedAt: AUTHORED,
    });
    await db.insert(budgets).values({
        amount: 100,
        amountUsd: 108.7,
        categoryId: "cat-1",
        currency: "EUR",
        dateCreated: AUTHORED,
        green: true,
        id: "bud-1",
        name: "Coffee cap",
        startDate: AUTHORED,
        type: 2,
        updatedAt: AUTHORED,
    });
    await db.insert(mainBudget).values({
        amount: 2000,
        amountUsd: 2174,
        currency: "EUR",
        dateCreated: AUTHORED,
        green: false,
        id: "main-1",
        name: "Everything",
        startDate: AUTHORED,
        type: 3,
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

        const readable = await db.select().from(transactions).where(isNull(transactions.deletedAt));
        expect(readable).toHaveLength(0);

        const replicable = await db.select().from(transactions);
        expect(replicable).toHaveLength(1);
        expect(replicable[0].id).toBe("tx-1");
        expect(replicable[0].deletedAt).not.toBeNull();
    });

    // Recently Deleted is the one screen built to read tombstones, so an erase
    // writes straight into it: without the exclusion the user is handed the ledger
    // they just erased back, row by row, each with a Restore button.
    it("keeps the rows it erased out of Recently Deleted", async () => {
        const removed = new Date("2026-02-01T00:00:00.000Z");
        await db.insert(transactions).values({
            amount: 7,
            date: AUTHORED,
            day: AUTHORED,
            deletedAt: removed,
            id: "tx-2",
            income: false,
            month: AUTHORED,
            note: "already gone",
            updatedAt: removed,
        });

        await eraseLedger(db, "transactions");

        expect((await deletedTransactionsQuery(db)).map((row) => row.id)).toStrictEqual(["tx-2"]);
    });

    // A column added to `transactions` and not to the constant would survive the
    // erase on the tombstone, and no round-trip assertion above would notice.
    it("names every column of a transaction that is not the envelope", () => {
        const ENVELOPE = new Set(["id", "updatedAt", "deletedAt"]);
        const declared = Object.keys(getTableColumns(transactions)).filter((name) => !ENVELOPE.has(name));

        expect(Object.keys(ERASED_TRANSACTION).sort()).toStrictEqual(declared.sort());
    });

    it("strips everything personal off a transaction tombstone", async () => {
        await eraseLedger(db, "transactions");

        const [row] = await db.select().from(transactions);
        expect(row.amount).toBe(0);
        expect(row.income).toBe(false);
        expect(row.currency).toBeNull();
        expect(row.note).toBe("");
        expect(row.details).toBeNull();
        expect(row.date.getTime()).toBe(0);
        expect(row.day.getTime()).toBe(0);
        expect(row.month.getTime()).toBe(0);
        expect(row.icon).toBeNull();
        expect(row.emoji).toBeNull();
        expect(row.customColor).toBeNull();
        expect(row.imageColor).toBeNull();
        expect(row.imageUri).toBeNull();
        expect(row.onceRecurring).toBe(false);
        expect(row.recurringType).toBe(0);
        expect(row.recurringCoefficient).toBe(1);
        expect(row.recurringEndDate).toBeNull();
        expect(row.reminderLeadDays).toBeNull();
        expect(row.categoryId).toBeNull();
        expect(row.accountId).toBeNull();
        expect(row.amountUsd).toBeNull();
        expect(row.exchangeRate).toBeNull();
        expect(row.exchangeRateType).toBeNull();
    });

    it("keeps budgets live under the transactions scope", async () => {
        await eraseLedger(db, "transactions");

        const liveBudgets = await db.select().from(budgets).where(isNull(budgets.deletedAt));
        expect(liveBudgets).toHaveLength(1);
        const liveMain = await db.select().from(mainBudget).where(isNull(mainBudget.deletedAt));
        expect(liveMain).toHaveLength(1);
    });

    it("strips everything personal off budget tombstones", async () => {
        await eraseLedger(db, "everything");

        const [budget] = await db.select().from(budgets);
        expect(budget.deletedAt).not.toBeNull();
        expect(budget.name).toBeNull();
        expect(budget.amount).toBe(0);
        expect(budget.type).toBe(0);
        expect(budget.startDate).toBeNull();
        expect(budget.dateCreated).toBeNull();
        expect(budget.currency).toBeNull();
        expect(budget.amountUsd).toBeNull();
        expect(budget.green).toBe(false);
        expect(budget.categoryId).toBeNull();

        const [main] = await db.select().from(mainBudget);
        expect(main.deletedAt).not.toBeNull();
        expect(main.name).toBeNull();
        expect(main.amount).toBe(0);
        expect(main.type).toBe(0);
        expect(main.startDate).toBeNull();
        expect(main.dateCreated).toBeNull();
        expect(main.currency).toBeNull();
        expect(main.amountUsd).toBeNull();
        expect(main.green).toBe(false);
    });

    it("frees the category so a new budget can be attached to it", async () => {
        await eraseLedger(db, "everything");

        const now = new Date();
        await db.insert(budgets).values({
            amount: 50,
            categoryId: "cat-1",
            green: false,
            id: "bud-2",
            type: 2,
            updatedAt: now,
        });
        const live = await db.select().from(budgets).where(isNull(budgets.deletedAt));
        expect(live).toHaveLength(1);
        expect(live[0].id).toBe("bud-2");
    });

    it("keeps categories untouched under either scope", async () => {
        await eraseLedger(db, "everything");

        const live = await db.select().from(categories).where(isNull(categories.deletedAt));
        expect(live).toHaveLength(1);
        expect(live[0].name).toBe("Coffee");
        expect(live[0].updatedAt.getTime()).toBe(AUTHORED.getTime());
    });

    it("does not re-stamp a tombstone it already wrote", async () => {
        await eraseLedger(db, "everything");
        const first = await db.select().from(transactions);
        const firstBudget = await db.select().from(budgets);

        await eraseLedger(db, "everything");

        const second = await db.select().from(transactions);
        expect(second).toHaveLength(1);
        expect(second[0].deletedAt?.getTime()).toBe(first[0].deletedAt?.getTime());
        expect(second[0].updatedAt.getTime()).toBe(first[0].updatedAt.getTime());

        const secondBudget = await db.select().from(budgets);
        expect(secondBudget[0].updatedAt.getTime()).toBe(firstBudget[0].updatedAt.getTime());
    });

    it("leaves a row another path already tombstoned alone", async () => {
        const removed = new Date("2026-02-01T00:00:00.000Z");
        await db.insert(transactions).values({
            amount: 7,
            date: AUTHORED,
            day: AUTHORED,
            deletedAt: removed,
            id: "tx-2",
            income: false,
            month: AUTHORED,
            note: "already gone",
            updatedAt: removed,
        });

        await eraseLedger(db, "transactions");

        const rows = await db.select().from(transactions);
        const survivor = rows.find((row) => row.id === "tx-2");
        expect(survivor?.deletedAt?.getTime()).toBe(removed.getTime());
        expect(survivor?.updatedAt.getTime()).toBe(removed.getTime());
        expect(survivor?.note).toBe("already gone");
    });
});
