import { beforeEach, describe, expect, it, jest, test } from "@jest/globals";
import { eq, isNull, ne } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { migratedDatabase, transactionalDatabase } from "@/db/test-database";
import type { PendingWrite } from "@/lib/pending-writes-core";

import { getMeta, META_KEYS } from "./app-meta-core";
import { cardFeeFor } from "./card-fees-core";
import {
    applyPendingWrites,
    drainPendingWrites,
    fileWaitingPurchases,
    parseWalletCards,
    pendingWriteTxId,
    pickCardAccount,
    WALLET_DEDUPE_WINDOW_MS,
} from "./pending-writes-core";
import { transactionsRepo } from "./transactions-core";

const makeDb = migratedDatabase;

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

/** {@link liveRows} without the tombstones, which is what the name suggests. */
async function undeleted(db: Database) {
    return db.select({ id: transactions.id }).from(transactions).where(isNull(transactions.deletedAt));
}

describe("applyPendingWrites", () => {
    let db: Database;

    beforeEach(async () => {
        db = makeDb();
        await seedCategories(db);
    });

    it("reads a notification job's amount and merchant, and files it by account", async () => {
        await seedAccounts(db);
        const job = walletWrite("push", {
            amount: 0,
            amountText: null,
            card: "Chase",
            dedupeKey: "notification:expense:x",
            note: "",
            text: "Purchase alert\nYou made a $12.40 purchase at STARBUCKS with your card ending in 4321.",
        });

        const applied = await applyPendingWrites(db, [job], NOW);

        expect(applied).toBe(1);
        const [row] = await db
            .select({
                accountId: transactions.accountId,
                amount: transactions.amount,
                currency: transactions.currency,
                note: transactions.note,
            })
            .from(transactions);
        expect(row).toStrictEqual({ accountId: "acc-chase", amount: 12.4, currency: "MXN", note: "STARBUCKS" });
    });

    it("files a refund push as income", async () => {
        const job = walletWrite("refund", {
            amount: 0,
            amountText: null,
            dedupeKey: "notification:expense:refund",
            note: "",
            text: "Refund of $12.40 from STARBUCKS",
        });

        await applyPendingWrites(db, [job], NOW);

        const [row] = await db
            .select({ categoryId: transactions.categoryId, income: transactions.income, note: transactions.note })
            .from(transactions);
        expect(row).toStrictEqual({ categoryId: "cat-income", income: true, note: "STARBUCKS" });
    });

    it("skips a notification that names no amount", async () => {
        const job = walletWrite("statement", { amount: 0, note: "", text: "Your statement is ready" });

        const applied = await applyPendingWrites(db, [job], NOW);

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(0);
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
        const settled = NOW.getTime() + WALLET_DEDUPE_WINDOW_MS - 1;

        const applied = await applyPendingWrites(
            db,
            [walletWrite("settle", { date: settled })],
            new Date(settled + WALLET_DEDUPE_WINDOW_MS * 30)
        );

        expect(applied).toBe(0);
        await expect(liveRows(db)).resolves.toHaveLength(1);
    });

    it("keeps the same purchase made again past the window", async () => {
        await applyPendingWrites(db, [walletWrite("morning")], NOW);
        const later = NOW.getTime() + WALLET_DEDUPE_WINDOW_MS + 1;

        const applied = await applyPendingWrites(db, [walletWrite("noon", { date: later })], new Date(later));

        expect(applied).toBe(1);
        await expect(liveRows(db)).resolves.toHaveLength(2);
    });

    it("keeps two purchases far apart that were queued while the app was closed", async () => {
        const evening = NOW.getTime() + WALLET_DEDUPE_WINDOW_MS * 50;

        const applied = await applyPendingWrites(
            db,
            [walletWrite("morning"), walletWrite("evening", { date: evening })],
            new Date(evening + 1)
        );

        expect(applied).toBe(2);
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

    it("files a card's waiting and later purchases under the account picked for it", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        await pickCardAccount(db, "Binance Card", "acc-n26");
        await applyPendingWrites(db, [walletWrite("b", { card: "Binance Card", dedupeKey: null })], NOW);

        const rows = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(rows.map((row) => String(row.accountId))).toStrictEqual(["acc-n26", "acc-n26"]);
    });

    it("keeps the account given by hand to a purchase that waited on its card", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        await db.update(transactions).set({ accountId: "acc-chase" });
        await pickCardAccount(db, "Binance Card", "acc-n26");

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBe("acc-chase");
    });

    it("keeps a card's waiting purchases through a No account or gone-account pick", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        await pickCardAccount(db, "Binance Card", "acc-deleted");
        await pickCardAccount(db, "Binance Card", null);
        await pickCardAccount(db, "Binance Card", "acc-n26");

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBe("acc-n26");
    });

    it("files a card's waiting purchases once the card matches an account by name", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: NOW,
            id: "acc-binance",
            initialBalanceDate: NOW,
            name: "Binance",
            updatedAt: NOW,
        });
        await fileWaitingPurchases(db);

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBe("acc-binance");
    });

    it("leaves a waiting purchase that predates the account's opening balance", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: NOW,
            id: "acc-binance",
            initialBalanceDate: new Date(NOW.getTime() + 60 * 60 * 1000),
            name: "Binance",
            updatedAt: NOW,
        });
        await fileWaitingPurchases(db);

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBeNull();
    });

    it("files a waiting purchase restored after its card got the account", async () => {
        await seedAccounts(db);
        await applyPendingWrites(
            db,
            [walletWrite("a", { card: "Binance Card", currency: "USD", dedupeKey: null })],
            NOW
        );
        const [queued] = await db.select({ id: transactions.id }).from(transactions);
        await transactionsRepo.remove(db, queued?.id ?? "");
        await pickCardAccount(db, "Binance Card", "acc-n26");
        await transactionsRepo.restore(db, queued?.id ?? "");
        await fileWaitingPurchases(db);

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBe("acc-n26");
    });

    it("queues nothing on a card while the ledger has no accounts", async () => {
        await applyPendingWrites(db, [walletWrite("a", { card: "Visa", currency: "USD", dedupeKey: null })], NOW);

        const cards = parseWalletCards(await getMeta(db, META_KEYS.walletCards));
        expect(cards.map((card) => card.waiting)).toStrictEqual([undefined]);
    });

    it("does not stretch the dedupe window from a skipped duplicate", async () => {
        const minute = 60 * 1000;
        await applyPendingWrites(
            db,
            [
                walletWrite("a"),
                walletWrite("b", { date: NOW.getTime() + 9 * minute }),
                walletWrite("c", { date: NOW.getTime() + 18 * minute }),
            ],
            NOW
        );

        await expect(db.select().from(transactions)).resolves.toHaveLength(2);
    });

    it("points a skipped duplicate's enqueue at the row its purchase landed in", async () => {
        await applyPendingWrites(db, [walletWrite("a"), walletWrite("b")], NOW);

        const rows = await db.select({ id: transactions.id }).from(transactions);
        expect(rows).toHaveLength(1);
        await expect(pendingWriteTxId(db, "b")).resolves.toBe(rows[0]?.id);
    });

    it("leaves a purchase whose currency was a guess off its card's waiting list", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { card: "Binance Card", dedupeKey: null })], NOW);
        await pickCardAccount(db, "Binance Card", "acc-n26");

        const [row] = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(row?.accountId).toBeNull();
    });

    it("leaves a card unattached when No account was picked over its name match", async () => {
        await seedAccounts(db);
        await applyPendingWrites(db, [walletWrite("a", { card: "Chase Sapphire", dedupeKey: null })], NOW);
        await pickCardAccount(db, "Chase Sapphire", null);
        await applyPendingWrites(db, [walletWrite("b", { card: "Chase Sapphire", dedupeKey: null })], NOW);

        const rows = await db.select({ accountId: transactions.accountId }).from(transactions);
        expect(rows.map((row) => String(row.accountId)).toSorted()).toStrictEqual(["acc-chase", "null"]);
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

    // The queue delivers at least once: an interrupted drain leaves the file in
    // place, so the same enqueue id comes back. Deleting the duplicate it wrote
    // is the user saying the charge belongs on the ledger once, and re-running
    // the automation has to be able to put it back — but only once more.
    it("does not re-write a replayed job again after the first replay landed", async () => {
        const job = walletWrite("j1");
        await applyPendingWrites(db, [job], NOW);
        const [first] = await liveRows(db);

        // The user deletes it as a duplicate, so the tombstone must not block a
        // genuine re-run.
        await transactionsRepo.remove(db, first?.id ?? "", NOW);
        const replay = new Date(NOW.getTime() + WALLET_DEDUPE_WINDOW_MS + 1);
        await applyPendingWrites(db, [job], replay);
        await expect(undeleted(db)).resolves.toHaveLength(1);

        // Every launch after that replays the same file. The ledger entry now
        // points at the live row, so nothing more is written.
        const later = new Date(replay.getTime() + WALLET_DEDUPE_WINDOW_MS + 1);
        await applyPendingWrites(db, [job], later);
        await applyPendingWrites(db, [job], new Date(later.getTime() + WALLET_DEDUPE_WINDOW_MS + 1));

        await expect(undeleted(db)).resolves.toHaveLength(1);
    });
});

describe("drainPendingWrites", () => {
    let db: Database;

    beforeEach(async () => {
        db = makeDb();
        await seedCategories(db);
    });

    it("applies a job once when two drains overlap", async () => {
        const job = walletWrite("wallet-1");
        let released = 0;
        // The real claim: it re-returns an unreleased claim on purpose, so a
        // crash mid-drain is recovered. That is what makes the overlap dangerous.
        const claim = () => ({ jobs: [job], names: ["claimed-1.jsonl"] });
        const release = () => {
            released += 1;
        };

        // Both catch-up paths firing at once: the effect body at mount, and the
        // first AppState "active" a few hundred milliseconds later.
        const [first, second] = await Promise.all([
            drainPendingWrites(db, claim, release),
            drainPendingWrites(db, claim, release),
        ]);

        await expect(db.select().from(transactions)).resolves.toHaveLength(1);
        expect(first).toBe(1);
        expect(second).toBe(1);
        expect(released).toBe(1);
    });

    it("drains again once the first pass has finished", async () => {
        const claim = jest
            .fn<() => { jobs: PendingWrite[]; names: string[] }>()
            .mockReturnValueOnce({ jobs: [walletWrite("wallet-1")], names: ["a.jsonl"] })
            .mockReturnValueOnce({
                jobs: [walletWrite("wallet-2", { dedupeKey: "wallet:expense:other:100" })],
                names: ["b.jsonl"],
            });

        await drainPendingWrites(db, claim, () => undefined);
        await drainPendingWrites(db, claim, () => undefined);

        await expect(db.select().from(transactions)).resolves.toHaveLength(2);
    });
});

test("adds the card's usual fee to a foreign Wallet charge, inside the queue's own transaction", async () => {
    const db = transactionalDatabase();
    await seedCategories(db);
    await seedAccounts(db);
    await transactionsRepo.create(db, {
        accountId: "acc-n26",
        amount: 10,
        categoryId: "cat-expense",
        currency: "USD",
        date: new Date("2026-03-01T09:00:00Z"),
        details: null,
        fee: { amount: null, categoryId: "cat-expense", currency: "EUR", note: "Fee · Grok", rate: 0.035 },
        income: false,
        note: "Grok",
    });

    await applyPendingWrites(db, [walletWrite("a", { amountText: "$6.40", card: "N26", currency: "USD" })], NOW);

    const [charge] = await db.select().from(transactions).where(eq(transactions.note, "Blue Bottle"));
    expect(cardFeeFor(db, charge?.id ?? "")).toMatchObject({ currency: "EUR", feeRate: 0.035 });
});

test("adds the card's usual fee when a foreign charge that waited on its card gets the account", async () => {
    const db = transactionalDatabase();
    await seedCategories(db);
    await seedAccounts(db);
    await transactionsRepo.create(db, {
        accountId: "acc-n26",
        amount: 10,
        categoryId: "cat-expense",
        currency: "USD",
        date: new Date("2026-03-01T09:00:00Z"),
        details: null,
        fee: { amount: null, categoryId: "cat-expense", currency: "EUR", note: "Fee · Grok", rate: 0.035 },
        income: false,
        note: "Grok",
    });
    await applyPendingWrites(db, [walletWrite("a", { amountText: "$6.40", card: "Work card", currency: "USD" })], NOW);

    await pickCardAccount(db, "Work card", "acc-n26");

    const [charge] = await db.select().from(transactions).where(eq(transactions.note, "Blue Bottle"));
    expect(charge?.accountId).toBe("acc-n26");
    expect(cardFeeFor(db, charge?.id ?? "")).toMatchObject({ accountId: "acc-n26", currency: "EUR", feeRate: 0.035 });
});

test("keeps a fee typed on a waiting charge when its card gets the account", async () => {
    const db = transactionalDatabase();
    await seedCategories(db);
    await seedAccounts(db);
    await transactionsRepo.create(db, {
        accountId: "acc-n26",
        amount: 10,
        categoryId: "cat-expense",
        currency: "USD",
        date: new Date("2026-03-01T09:00:00Z"),
        details: null,
        fee: { amount: null, categoryId: "cat-expense", currency: "EUR", note: "Fee · Grok", rate: 0.035 },
        income: false,
        note: "Grok",
    });
    await applyPendingWrites(db, [walletWrite("a", { amountText: "$6.40", card: "Work card", currency: "USD" })], NOW);
    const [charge] = await db.select().from(transactions).where(eq(transactions.note, "Blue Bottle"));
    await db.insert(transactions).values({
        amount: 1.5,
        categoryId: "cat-expense",
        currency: "USD",
        date: NOW,
        day: charge?.day ?? NOW,
        feeForId: charge?.id ?? "",
        id: "typed-fee",
        income: false,
        month: charge?.month ?? NOW,
        note: "Fee · Blue Bottle",
        updatedAt: NOW,
    });

    await pickCardAccount(db, "Work card", "acc-n26");

    expect(cardFeeFor(db, charge?.id ?? "")).toMatchObject({ accountId: "acc-n26", amount: 1.5, id: "typed-fee" });
});
