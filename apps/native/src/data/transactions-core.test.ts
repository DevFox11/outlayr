import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { accounts, exchangeRates, outbox, transactions, transfers } from "@/db/schema";
import { groupByDay } from "@/domain/day-sections";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { buildTransactionInput } from "@/domain/transaction-form-save";

import { setSyncEnabled } from "./sync-outbox-core";
import {
    accountTransactionsQuery,
    deletedTransactionsQuery,
    ledgerSizeQuery,
    logWindowDaysQuery,
    transactionsRepo,
} from "./transactions-core";
import type { TransactionInput } from "./transactions-core";
import { transfersRepo } from "./transfers-core";

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
        const sql = readFileSync(join(MIGRATIONS, file), "utf-8");
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
            "INSERT INTO categories (id, name, income, sortOrder, updatedAt) VALUES ('cat-1', 'Groceries', 0, 0, 1)"
        )
        .run();
    return drizzle(sqlite) as unknown as Database;
}

/** Older than the 90 days of history the rate feed serves. */
const LONG_AGO = new Date(Date.UTC(2020, 0, 1, 12));

const DRAFT: TransactionInput = {
    amount: 100,
    categoryId: "cat-1",
    currency: "EUR",
    date: LONG_AGO,
    details: null,
    income: false,
    note: "Bakery",
};

async function frozen(db: Database, id: string) {
    const [row] = await db
        .select({
            amount: transactions.amount,
            amountUsd: transactions.amountUsd,
            exchangeRate: transactions.exchangeRate,
            exchangeRateType: transactions.exchangeRateType,
            note: transactions.note,
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
            date: "2020-01-01",
            fetchedAt: LONG_AGO.getTime(),
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });
        id = await transactionsRepo.create(db, DRAFT);
        // `pullRatesIfDue` replaces the replica wholesale and the feed only serves
        // the last 90 days, so a row this old becomes unvaluable again.
        await db.delete(exchangeRates);
    });

    it("freezes the value at the rate of the day it happened", async () => {
        const row = await frozen(db, id);
        expect(row.amountUsd).toBe(111.111111);
        expect(row.exchangeRate).toBe(0.9);
        expect(row.exchangeRateType).toBe("official");
    });

    it("keeps that value when the edit leaves the money alone", async () => {
        await transactionsRepo.update(db, id, {
            ...DRAFT,
            note: "Bakery, corner one",
        });

        const row = await frozen(db, id);
        expect(row.note).toBe("Bakery, corner one");
        expect(row.amountUsd).toBe(111.111111);
        expect(row.exchangeRate).toBe(0.9);
        expect(row.exchangeRateType).toBe("official");
    });

    it("declines to carry it onto an amount it no longer describes", async () => {
        await transactionsRepo.update(db, id, { ...DRAFT, amount: 200 });

        const row = await frozen(db, id);
        expect(row.amount).toBe(200);
        expect(row.amountUsd).toBeNull();
        expect(row.exchangeRate).toBeNull();
        expect(row.exchangeRateType).toBe("official");
    });

    it("re-freezes a changed amount whenever the rate is back", async () => {
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: LONG_AGO.getTime(),
            quote: "EUR",
            rate: 0.9,
            rateType: "official",
            source: "frankfurter",
        });

        await transactionsRepo.update(db, id, { ...DRAFT, amount: 200 });

        const row = await frozen(db, id);
        expect(row.amountUsd).toBe(222.222222);
        expect(row.exchangeRate).toBe(0.9);
    });
});

describe("transactionsRepo entry-rate selections", () => {
    it("keeps a custom freeze when a real form mapper omits rate fields on an unrelated edit", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            currency: "VES",
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        const input = buildTransactionInput({
            accountId: null,
            amount: 100,
            categoryId: "cat-1",
            coefficient: 1,
            currency: "VES",
            customColor: null,
            date: LONG_AGO,
            details: "",
            emoji: null,
            endDate: LONG_AGO,
            hasEndDate: false,
            icon: null,
            imageColor: null,
            imageUri: null,
            income: false,
            isSubscription: false,
            leadDays: null,
            note: "Renamed",
            recurringType: RECURRING_TYPE.none,
        });
        await transactionsRepo.update(db, id, input);
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
    });
    async function seedRate(
        db: Database,
        quote: string,
        rateType: "official" | "eur_reference",
        rate: number
    ): Promise<void> {
        await db.insert(exchangeRates).values({
            date: "2020-01-01",
            fetchedAt: LONG_AGO.getTime(),
            quote,
            rate,
            rateType,
            source: "frankfurter",
        });
    }

    it("freezes a custom transaction from the supplied actual rate", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            currency: "VES",
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
    });

    it("freezes a VES transaction from the EUR-reference feed", async () => {
        const db = makeDb();
        await seedRate(db, "VES", "eur_reference", 50);
        await seedRate(db, "EUR", "official", 0.8);
        const id = await transactionsRepo.create(db, { ...DRAFT, currency: "VES", exchangeRateType: "eur_reference" });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 2.5,
            exchangeRate: 50,
            exchangeRateType: "eur_reference",
        });
    });

    it("keeps omitted metadata backward-compatible with official", async () => {
        const db = makeDb();
        await seedRate(db, "EUR", "official", 0.8);
        const id = await transactionsRepo.create(db, DRAFT);
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 125,
            exchangeRate: 0.8,
            exchangeRateType: "official",
        });
    });

    it("clears supplied metadata for USD", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            currency: "USD",
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 100,
            exchangeRate: 1,
            exchangeRateType: null,
        });
    });

    it("restores an imported positive provider rate without replacing it from the local feed", async () => {
        const db = makeDb();
        await seedRate(db, "EUR", "official", 0.9);
        const id = await transactionsRepo.create(db, { ...DRAFT, exchangeRate: 0.8, exchangeRateType: "official" });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 125,
            exchangeRate: 0.8,
            exchangeRateType: "official",
        });
    });

    it("keeps a frozen custom value through an unrelated note edit", async () => {
        const db = makeDb();
        const input = { ...DRAFT, currency: "VES", exchangeRate: 55.5, exchangeRateType: "custom" } as const;
        const id = await transactionsRepo.create(db, input);
        await transactionsRepo.update(db, id, { ...input, note: "Updated" });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
    });

    it("re-freezes when an edit changes official to custom without changing amount currency or date", async () => {
        const db = makeDb();
        await seedRate(db, "EUR", "official", 0.8);
        const id = await transactionsRepo.create(db, DRAFT);
        await transactionsRepo.update(db, id, { ...DRAFT, exchangeRate: 0.5, exchangeRateType: "custom" });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 200,
            exchangeRate: 0.5,
            exchangeRateType: "custom",
        });
    });

    it("re-freezes when an edit changes only the custom actual rate", async () => {
        const db = makeDb();
        const input = { ...DRAFT, currency: "VES", exchangeRate: 50, exchangeRateType: "custom" } as const;
        const id = await transactionsRepo.create(db, input);
        await transactionsRepo.update(db, id, { ...input, exchangeRate: 40 });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: 2.5,
            exchangeRate: 40,
            exchangeRateType: "custom",
        });
    });

    it("keeps a pending custom row pending through an unrelated edit", async () => {
        const db = makeDb();
        const input = { ...DRAFT, currency: "VES", exchangeRate: null, exchangeRateType: "custom" } as const;
        const id = await transactionsRepo.create(db, input);
        await transactionsRepo.update(db, id, { ...input, note: "Updated" });
        expect(await frozen(db, id)).toMatchObject({
            amountUsd: null,
            exchangeRate: null,
            exchangeRateType: "custom",
        });
    });
});

describe("transactionsRepo.update and the replicated photo key", () => {
    const PHOTO = "file:///container/Documents/transaction-photos/a.jpg";
    const KEY = "transaction-photos/user-aaaa/a.jpg";

    async function photoColumns(db: Database, id: string) {
        const [row] = await db
            .select({
                imageKey: transactions.imageKey,
                imageUri: transactions.imageUri,
            })
            .from(transactions)
            .where(eq(transactions.id, id));
        return row;
    }

    it("clears the key when the user takes a visible photo off", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, { ...DRAFT, imageUri: PHOTO });
        await db.update(transactions).set({ imageKey: KEY }).where(eq(transactions.id, id));

        await transactionsRepo.update(db, id, { ...DRAFT, imageUri: null });

        expect(await photoColumns(db, id)).toStrictEqual({
            imageKey: null,
            imageUri: null,
        });
    });

    it("keeps the key when the row's bytes have not reached this device", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, DRAFT);
        await db.update(transactions).set({ imageKey: KEY }).where(eq(transactions.id, id));

        // Saving an unrelated edit on a row whose photo is still downloading must
        // not read as "the user removed the photo" — that would delete it account-wide.
        await transactionsRepo.update(db, id, { ...DRAFT, note: "Renamed" });

        expect((await photoColumns(db, id)).imageKey).toBe(KEY);
    });

    it("keeps the superseded key when the photo is replaced, for the uploader to release", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, { ...DRAFT, imageUri: PHOTO });
        await db.update(transactions).set({ imageKey: KEY }).where(eq(transactions.id, id));

        await transactionsRepo.update(db, id, {
            ...DRAFT,
            imageUri: "file:///container/Documents/transaction-photos/b.jpg",
        });

        expect((await photoColumns(db, id)).imageKey).toBe(KEY);
    });
});

describe("the reminder notice on a subscription", () => {
    const NOW = new Date(2026, 3, 1, 9, 0);
    const SUBSCRIPTION: TransactionInput = {
        amount: 12,
        categoryId: "cat-1",
        currency: "USD",
        date: new Date(2026, 2, 15),
        details: null,
        income: false,
        note: "Netflix",
        onceRecurring: true,
        recurringCoefficient: 1,
        recurringType: RECURRING_TYPE.monthly,
        reminderLeadDays: 3,
    };

    async function notices(db: Database) {
        return db
            .select({
                deletedAt: transactions.deletedAt,
                id: transactions.id,
                reminderLeadDays: transactions.reminderLeadDays,
            })
            .from(transactions);
    }

    it("hands the notice to the successor and clears it on the tombstone", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, SUBSCRIPTION);

        await transactionsRepo.remove(db, id, NOW);

        const rows = await notices(db);
        expect(rows.find((row) => row.id === id)?.reminderLeadDays).toBeNull();
        const successor = rows.find((row) => row.id !== id);
        expect(successor?.deletedAt).toBeNull();
        expect(successor?.reminderLeadDays).toBe(3);
    });

    it("clears the notice when the schedule is stopped", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, SUBSCRIPTION);

        await transactionsRepo.stopRecurring(db, id, NOW);

        const [row] = await notices(db);
        expect(row?.reminderLeadDays).toBeNull();
    });

    it("writes no notice on a transaction that does not recur", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...SUBSCRIPTION,
            onceRecurring: false,
            recurringType: RECURRING_TYPE.none,
        });

        const [row] = await notices(db);
        expect(row?.id).toBe(id);
        expect(row?.reminderLeadDays).toBeNull();
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
        expect(row?.reminderLeadDays).toBe(0);
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
        expect(rows.find((row) => row.id === sameDay)?.reminderLeadDays).toBe(0);
        expect(rows.find((row) => row.id === off)?.reminderLeadDays).toBeNull();
    });

    // The form builds its input from the fields it paints, so an edit made on a
    // screen without a lead picker leaves the key out entirely.
    it("keeps the notice through an edit that never mentions it", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, SUBSCRIPTION);
        const { reminderLeadDays: _absent, ...silentEdit } = SUBSCRIPTION;

        await transactionsRepo.update(db, id, { ...silentEdit, amount: 13 });

        const [row] = await notices(db);
        expect(row?.reminderLeadDays).toBe(3);
    });

    it("turns the notice off when an edit says null", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, SUBSCRIPTION);

        await transactionsRepo.update(db, id, {
            ...SUBSCRIPTION,
            reminderLeadDays: null,
        });

        const [row] = await notices(db);
        expect(row?.reminderLeadDays).toBeNull();
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
        expect(row?.reminderLeadDays).toBeNull();
    });
});

describe("restoring a tombstoned transaction", () => {
    const DELETED_AT = new Date(2026, 3, 1, 9, 0);
    const RESTORED_AT = new Date(2026, 3, 2, 8, 30);
    const LATER_STILL = new Date(2026, 3, 3, 8, 30);

    async function timestamps(database: Database, transactionId: string) {
        const [row] = await database
            .select({
                deletedAt: transactions.deletedAt,
                recurringType: transactions.recurringType,
                reminderLeadDays: transactions.reminderLeadDays,
                updatedAt: transactions.updatedAt,
            })
            .from(transactions)
            .where(eq(transactions.id, transactionId));
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
        expect(await ledgerSizeQuery(db)).toStrictEqual([]);

        await transactionsRepo.restore(db, id, RESTORED_AT);

        expect((await ledgerSizeQuery(db)).map((row) => row.id)).toStrictEqual([id]);
        expect(await logWindowDaysQuery(db, Date.now(), 30)).toHaveLength(1);
    });

    it("takes the entry off the deleted list it was restored from", async () => {
        expect((await deletedTransactionsQuery(db)).map((row) => row.id)).toStrictEqual([id]);

        await transactionsRepo.restore(db, id, RESTORED_AT);

        expect(await deletedTransactionsQuery(db)).toStrictEqual([]);
    });

    it("moves updatedAt, so a peer is told the row came back", async () => {
        await transactionsRepo.restore(db, id, RESTORED_AT);

        const row = await timestamps(db, id);
        expect(row?.deletedAt).toBeNull();
        expect(row?.updatedAt.getTime()).toBe(RESTORED_AT.getTime());
    });

    it("writes nothing the second time, so a restore is idempotent", async () => {
        await transactionsRepo.restore(db, id, RESTORED_AT);
        await transactionsRepo.restore(db, id, LATER_STILL);

        expect((await timestamps(db, id))?.updatedAt.getTime()).toBe(RESTORED_AT.getTime());
    });

    it("leaves a subscription the delete ended ended", async () => {
        const carrier = await transactionsRepo.create(db, {
            ...DRAFT,
            onceRecurring: true,
            recurringCoefficient: 1,
            recurringType: RECURRING_TYPE.monthly,
            reminderLeadDays: 3,
        });
        await transactionsRepo.remove(db, carrier, DELETED_AT);

        await transactionsRepo.restore(db, carrier, RESTORED_AT);

        const row = await timestamps(db, carrier);
        expect(row?.recurringType).toBe(RECURRING_TYPE.none);
        expect(row?.reminderLeadDays).toBeNull();
    });
});

describe("a restore the account has to hear about", () => {
    const DELETED_AT = new Date(2026, 3, 1, 9, 0);
    const RESTORED_AT = new Date(2026, 3, 2, 8, 30);
    const LATER_STILL = new Date(2026, 3, 3, 8, 30);

    async function queued(db: Database) {
        return db
            .select({
                localId: outbox.localId,
                seq: outbox.seq,
                tableName: outbox.tableName,
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

        expect((await queued(db)).map((row) => [row.tableName, row.localId])).toStrictEqual([["transactions", id]]);
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
        expect((await queued(db))[0]?.seq).toBe(first);
    });
});

describe("the fee on a transfer the user deleted", () => {
    const WHEN = new Date(Date.UTC(2026, 5, 1, 12));
    const DELETED_AT = new Date(Date.UTC(2026, 5, 2, 9));

    async function movedWithAFee() {
        const db = syncedDb();
        await db.insert(accounts).values([
            {
                currency: "USD",
                dateCreated: WHEN,
                id: "acc-checking",
                initialBalanceDate: WHEN,
                name: "Checking",
                updatedAt: WHEN,
            },
            {
                currency: "USD",
                dateCreated: WHEN,
                id: "acc-savings",
                initialBalanceDate: WHEN,
                name: "Savings",
                updatedAt: WHEN,
            },
        ]);
        const transferId = await transfersRepo.create(db, {
            date: WHEN,
            exchangeRate: null,
            exchangeRateType: null,
            fee: { amount: 3, categoryId: "cat-1", note: "Wire fee", side: "source" },
            fromAccountId: "acc-checking",
            fromAmount: 500,
            fromCurrency: "USD",
            toAccountId: "acc-savings",
            toAmount: 500,
            toCurrency: "USD",
        });
        const [fee] = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(eq(transactions.transferId, transferId));
        return { db, feeId: fee.id, transferId };
    }

    it("takes the transfer with it when the row deleted is that transfer's fee", async () => {
        const { db, feeId, transferId } = await movedWithAFee();

        await transactionsRepo.remove(db, feeId, DELETED_AT);

        const [transfer] = await db
            .select({ deletedAt: transfers.deletedAt })
            .from(transfers)
            .where(eq(transfers.id, transferId));
        expect(transfer?.deletedAt).not.toBeNull();
        expect((await deletedTransactionsQuery(db)).map((row) => row.id)).toStrictEqual([]);
    });

    it("is not offered back on its own, while an ordinary expense still is", async () => {
        const { db, transferId } = await movedWithAFee();
        const groceries = await transactionsRepo.create(db, { ...DRAFT, currency: "USD" });
        await transactionsRepo.remove(db, groceries, DELETED_AT);

        await transfersRepo.softDelete(db, transferId, DELETED_AT);

        expect((await deletedTransactionsQuery(db)).map((row) => row.id)).toStrictEqual([groceries]);
    });

    it("stays tombstoned when a restore names it directly", async () => {
        const { db, feeId, transferId } = await movedWithAFee();
        await transfersRepo.softDelete(db, transferId, DELETED_AT);

        await transactionsRepo.restore(db, feeId, new Date(Date.UTC(2026, 5, 3, 9)));

        const [row] = await db
            .select({ deletedAt: transactions.deletedAt })
            .from(transactions)
            .where(eq(transactions.id, feeId));
        expect(row?.deletedAt?.getTime()).toBe(DELETED_AT.getTime());
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

        expect(await db.select({ seq: outbox.seq }).from(outbox)).toStrictEqual([]);
        expect((await ledgerSizeQuery(db)).map((row) => row.id).sort()).toStrictEqual([kept, afterOff].sort());
        expect((await deletedTransactionsQuery(db)).map((row) => row.id)).toStrictEqual([tombstoned]);
    });
});

describe("the account an entry is attached to", () => {
    async function attachedTo(db: Database, id: string) {
        const [row] = await db
            .select({ accountId: transactions.accountId })
            .from(transactions)
            .where(eq(transactions.id, id));
        return row?.accountId;
    }

    it("stamps the account on create", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            accountId: "acc-1",
        });

        expect(await attachedTo(db, id)).toBe("acc-1");
    });

    it("leaves the row detached when the input names no account", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, DRAFT);

        expect(await attachedTo(db, id)).toBeNull();
    });

    it("moves the attachment when an edit names another account", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            accountId: "acc-1",
        });

        await transactionsRepo.update(db, id, { ...DRAFT, accountId: "acc-2" });

        expect(await attachedTo(db, id)).toBe("acc-2");
    });

    it("detaches on an explicit null", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            accountId: "acc-1",
        });

        await transactionsRepo.update(db, id, { ...DRAFT, accountId: null });

        expect(await attachedTo(db, id)).toBeNull();
    });

    // The CSV import and the App Intent queue build their inputs without the
    // field, and neither of those saves is the user taking an entry off an
    // account.
    it("keeps the attachment through an edit that never mentions it", async () => {
        const db = makeDb();
        const id = await transactionsRepo.create(db, {
            ...DRAFT,
            accountId: "acc-1",
        });

        await transactionsRepo.update(db, id, { ...DRAFT, note: "Renamed" });

        expect(await attachedTo(db, id)).toBe("acc-1");
    });
});

describe("accountTransactionsQuery", () => {
    const JUNE_1 = new Date(Date.UTC(2026, 5, 1, 12));
    const JUNE_2 = new Date(Date.UTC(2026, 5, 2, 12));

    async function seed(db: Database, id: string, overrides: Partial<typeof transactions.$inferInsert>) {
        await db.insert(transactions).values({
            amount: 10,
            currency: "USD",
            date: JUNE_1,
            day: JUNE_1,
            id,
            income: false,
            month: JUNE_1,
            note: id,
            updatedAt: JUNE_1,
            ...overrides,
        });
    }

    it("returns only the account's live rows, newest first", async () => {
        const db = makeDb();
        await seed(db, "older", { accountId: "acc-1", date: JUNE_1, day: JUNE_1 });
        await seed(db, "newer", { accountId: "acc-1", date: JUNE_2, day: JUNE_2 });
        await seed(db, "detached", { accountId: null });
        await seed(db, "other", { accountId: "acc-2" });
        await seed(db, "gone", { accountId: "acc-1", deletedAt: JUNE_2 });

        const rows = await accountTransactionsQuery(db, "acc-1");

        expect(rows.map((row) => row.id)).toStrictEqual(["newer", "older"]);
    });

    it("hands groupByDay rows that section by day", async () => {
        const db = makeDb();
        await seed(db, "a", { accountId: "acc-1", date: JUNE_2, day: JUNE_2 });
        await seed(db, "b", { accountId: "acc-1", date: JUNE_1, day: JUNE_1 });
        await seed(db, "c", { accountId: "acc-1", date: JUNE_1, day: JUNE_1 });

        const sections = groupByDay(await accountTransactionsQuery(db, "acc-1"));

        expect(sections).toHaveLength(2);
        expect(sections[0].data.map((row) => row.id)).toStrictEqual(["a"]);
        expect(sections[1].data.map((row) => row.id)).toStrictEqual(["b", "c"]);
    });
});

describe("ledgerSizeQuery", () => {
    it("counts only what a reader can still see", async () => {
        const db = makeDb();
        const now = new Date();
        await db.insert(transactions).values([
            {
                amount: 10,
                date: now,
                day: now,
                id: "live",
                income: false,
                month: now,
                note: "",
                updatedAt: now,
            },
            {
                amount: 10,
                date: now,
                day: now,
                deletedAt: now,
                id: "tombstoned",
                income: false,
                month: now,
                note: "",
                updatedAt: now,
            },
        ]);

        const rows = await ledgerSizeQuery(db);
        expect(rows.map((row) => row.id)).toStrictEqual(["live"]);
    });
});
