import { describe, expect, it } from "@jest/globals";
import { utcDateString } from "@outlayr/money/dates";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { transactions, transfers } from "@/db/schema";
import { testDatabase, withAsyncTransactions } from "@/db/test-database";
import { firstOfMonth, startOfDay } from "@/domain/dates";

import { accountsRepo } from "./accounts-core";
import { transfersRepo } from "./transfers-core";

const DAY = new Date(Date.UTC(2026, 7, 9));
const OFFICIAL_VES_PER_USD = 55.5;
const P2P_VES_PER_USD = 60;

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    sqlite.exec(`
		CREATE TABLE appMeta (key text PRIMARY KEY NOT NULL, value text);
		CREATE TABLE accounts (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			currency text NOT NULL,
			initialBalance real DEFAULT 0 NOT NULL,
			initialBalanceUsd real,
			initialBalanceDate integer NOT NULL,
			kind text NOT NULL DEFAULT 'asset',
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
			fetchedAt integer NOT NULL, source text NOT NULL,
			PRIMARY KEY (quote, rateType, date)
		);
		INSERT INTO exchangeRates (quote, rateType, date, rate, fetchedAt, source)
		VALUES ('VES', 'official', '${utcDateString(DAY.getTime())}', ${OFFICIAL_VES_PER_USD}, 0, 'test');
	`);
    // withTransaction runs its task bare when the client has no async transaction
    // API, which would make every rollback assertion below vacuously true.
    withAsyncTransactions(sqlite);
    return testDatabase(sqlite);
}

function severTheDetach(db: Database): void {
    (db.$client as unknown as { exec: (sql: string) => void }).exec(`
		CREATE TRIGGER jetsam BEFORE UPDATE OF accountId ON transactions
		BEGIN SELECT RAISE(ABORT, 'the app died mid-delete'); END;
	`);
}

async function twoAccounts(db: Database) {
    const from = await accountsRepo.create(db, { currency: "USD", name: "Zinli" });
    const to = await accountsRepo.create(db, { currency: "VES", name: "Banesco" });
    return { from, to };
}

async function addEntry(db: Database, accountId: string, id: string): Promise<void> {
    await db.insert(transactions).values({
        accountId,
        amount: 9,
        date: DAY,
        day: DAY,
        id,
        income: false,
        month: DAY,
        updatedAt: DAY,
    });
}

const baseInput = (from: string, to: string) => ({
    date: DAY,
    exchangeRate: 55.5,
    exchangeRateType: "custom",
    fromAccountId: from,
    fromAmount: 100,
    fromCurrency: "USD",
    toAccountId: to,
    toAmount: 5550,
    toCurrency: "VES",
});

describe("transfersRepo.create", () => {
    it("stores the legs and the rate that links them", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        const id = await transfersRepo.create(db, baseInput(from, to));
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row).toMatchObject({
            exchangeRate: 55.5,
            exchangeRateType: "custom",
            fromAmount: 100,
            fromCurrency: "USD",
            toAmount: 5550,
            toCurrency: "VES",
        });
    });

    it("derives day and month from the date so the log can group it", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        const id = await transfersRepo.create(db, baseInput(from, to));
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.day.getTime()).toBe(startOfDay(DAY).getTime());
        expect(row.month.getTime()).toBe(firstOfMonth(DAY).getTime());
    });

    it("freezes both legs at the same USD value when the transfer went at the official rate", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            exchangeRate: OFFICIAL_VES_PER_USD,
            exchangeRateType: "official",
            toAmount: 100 * OFFICIAL_VES_PER_USD,
        });
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.fromAmountUsd).toBe(100);
        expect(row.toAmountUsd).toBe(100);
    });

    /**
     * Deliberate: a transfer struck away from the market moves net worth by the
     * spread, because that is what happened. Pinning the arriving leg to what left
     * would deny a real gain.
     */
    it("books the spread when the user transfers at a rate the market does not quote", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            exchangeRate: P2P_VES_PER_USD,
            exchangeRateType: "custom",
            toAmount: 100 * P2P_VES_PER_USD,
        });
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.fromAmountUsd).toBe(100);
        expect(row.toAmountUsd).toBeCloseTo((100 * P2P_VES_PER_USD) / OFFICIAL_VES_PER_USD, 5);
        expect(row.toAmountUsd).toBeGreaterThan(row.fromAmountUsd as number);
    });

    it("values each leg in its own currency when the money moves the other way", async () => {
        const db = makeDb();
        const from = await accountsRepo.create(db, { currency: "VES", name: "Banesco" });
        const to = await accountsRepo.create(db, { currency: "USD", name: "Zinli" });

        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            exchangeRate: P2P_VES_PER_USD,
            exchangeRateType: "custom",
            fromAmount: 100 * P2P_VES_PER_USD,
            fromCurrency: "VES",
            toAmount: 100,
            toCurrency: "USD",
        });
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.fromAmountUsd).toBeCloseTo((100 * P2P_VES_PER_USD) / OFFICIAL_VES_PER_USD, 5);
        expect(row.toAmountUsd).toBe(100);
    });

    it("leaves only the leg it cannot price unvalued", async () => {
        const db = makeDb();
        const from = await accountsRepo.create(db, { currency: "ARS", name: "Galicia" });
        const to = await accountsRepo.create(db, { currency: "USD", name: "Zinli" });

        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            exchangeRate: 1200,
            exchangeRateType: "official",
            fromAmount: 120_000,
            fromCurrency: "ARS",
            toAmount: 100,
            toCurrency: "USD",
        });
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.fromAmountUsd).toBeNull();
        expect(row.toAmountUsd).toBe(100);
    });

    it("writes no fee transaction when there is no fee", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        await transfersRepo.create(db, baseInput(from, to));

        await expect(db.select().from(transactions)).resolves.toStrictEqual([]);
    });

    it("writes a source-side fee as an expense on the source account", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            fee: { amount: 2.7, categoryId: "cat-fees", side: "source" },
        });
        const [fee] = await db.select().from(transactions);

        expect(fee).toMatchObject({
            accountId: from,
            amount: 2.7,
            categoryId: "cat-fees",
            currency: "USD",
            income: false,
            transferId: id,
        });
    });

    it("writes a destination-side fee in the destination currency and account", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        await transfersRepo.create(db, {
            ...baseInput(from, to),
            fee: { amount: 150, categoryId: "cat-fees", side: "destination" },
        });
        const [fee] = await db.select().from(transactions);

        expect(fee).toMatchObject({ accountId: to, amount: 150, currency: "VES", income: false });
    });

    it("refuses a transfer to the same account", async () => {
        const db = makeDb();
        const { from } = await twoAccounts(db);

        await expect(transfersRepo.create(db, baseInput(from, from))).rejects.toThrow(/same account/i);
    });

    it("refuses a non-positive leg", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);

        await expect(transfersRepo.create(db, { ...baseInput(from, to), fromAmount: 0 })).rejects.toThrow(/positive/i);
    });
});

describe("transfersRepo.softDelete", () => {
    it("tombstones the transfer", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        const id = await transfersRepo.create(db, baseInput(from, to));

        await transfersRepo.softDelete(db, id, DAY);
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.deletedAt).not.toBeNull();
    });

    it("takes the fee transaction with it", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        const id = await transfersRepo.create(db, {
            ...baseInput(from, to),
            fee: { amount: 2.7, categoryId: null, side: "source" },
        });

        await transfersRepo.softDelete(db, id, DAY);
        const [fee] = await db.select().from(transactions);

        expect(fee.deletedAt).not.toBeNull();
    });

    it("leaves an unrelated transaction alone", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        const id = await transfersRepo.create(db, baseInput(from, to));
        await addEntry(db, from, "other");

        await transfersRepo.softDelete(db, id, DAY);
        const [other] = await db.select().from(transactions).where(eq(transactions.id, "other"));

        expect(other.deletedAt).toBeNull();
    });
});

describe("deleting an account takes its transfers with it", () => {
    it("tombstones a transfer that leaves the deleted account", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        const id = await transfersRepo.create(db, baseInput(from, to));

        await accountsRepo.softDelete(db, from, DAY);
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.deletedAt).not.toBeNull();
    });

    it("tombstones a transfer that arrives at the deleted account", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        const id = await transfersRepo.create(db, baseInput(from, to));

        await accountsRepo.softDelete(db, to, DAY);
        const [row] = await db.select().from(transfers).where(eq(transfers.id, id));

        expect(row.deletedAt).not.toBeNull();
    });

    it("takes the fee with it, since a fee has no meaning without its transfer", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        await transfersRepo.create(db, {
            ...baseInput(from, to),
            fee: { amount: 2.7, categoryId: null, side: "source" },
        });

        await accountsRepo.softDelete(db, from, DAY);
        const [fee] = await db.select().from(transactions);

        expect(fee.deletedAt).not.toBeNull();
    });

    it("counts what a delete would take, for the confirmation copy", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        await transfersRepo.create(db, baseInput(from, to));
        await transfersRepo.create(db, { ...baseInput(to, from), fromCurrency: "VES", toCurrency: "USD" });

        await expect(transfersRepo.countForAccount(db, from)).resolves.toBe(2);
    });
});

describe("an account delete that cannot finish", () => {
    it("leaves every one of its transfers live", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        await transfersRepo.create(db, baseInput(from, to));
        await transfersRepo.create(db, baseInput(from, to));
        await transfersRepo.create(db, { ...baseInput(to, from), fromCurrency: "VES", toCurrency: "USD" });
        await addEntry(db, from, "groceries");
        severTheDetach(db);

        await expect(accountsRepo.softDelete(db, from, DAY)).rejects.toThrow(/mid-delete/);

        const rows = await db.select().from(transfers);
        expect(rows).toHaveLength(3);
        expect(rows.filter((row) => row.deletedAt === null)).toHaveLength(3);
        await expect(transfersRepo.countForAccount(db, from)).resolves.toBe(3);
        expect((await accountsRepo.listActive(db)).map((row) => row.id)).toContain(from);
        const [entry] = await db.select().from(transactions).where(eq(transactions.id, "groceries"));
        expect(entry.accountId).toBe(from);
    });

    it("leaves the fee transaction live with its transfer", async () => {
        const db = makeDb();
        const { from, to } = await twoAccounts(db);
        await transfersRepo.create(db, {
            ...baseInput(from, to),
            fee: { amount: 2.7, categoryId: null, side: "source" },
        });
        severTheDetach(db);

        await expect(accountsRepo.softDelete(db, from, DAY)).rejects.toThrow(/mid-delete/);

        const [fee] = await db.select().from(transactions);
        expect(fee.deletedAt).toBeNull();
    });
});
