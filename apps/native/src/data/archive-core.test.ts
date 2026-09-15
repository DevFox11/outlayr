import { beforeEach, describe, expect, it } from "@jest/globals";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";
import { migratedDatabase } from "@/db/test-database";
import { parseArchive, serializeArchive } from "@/domain/archive";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { buildArchive, restoreArchive } from "./archive-core";

const CATEGORY = {
    id: "c1",
    income: false,
    name: "Food",
    sortOrder: 0,
    updatedAt: new Date(1_700_000_000_000),
};

function transactionRow(id: string, overrides: Record<string, unknown> = {}) {
    return {
        amount: 12.5,
        categoryId: "c1",
        currency: "USD",
        date: new Date(1_700_000_000_000),
        day: new Date(1_700_000_000_000),
        id,
        income: false,
        month: new Date(1_700_000_000_000),
        note: "coffee",
        updatedAt: new Date(1_700_000_000_000),
        ...overrides,
    };
}

describe("archiving a ledger", () => {
    let db: Database;

    beforeEach(() => {
        db = migratedDatabase();
    });

    it("round-trips a ledger through serialize, parse and restore", async () => {
        await db.insert(categories).values(CATEGORY);
        await db.insert(transactions).values(transactionRow("t1"));

        const text = serializeArchive(await buildArchive(db, new Date()));
        const parsed = parseArchive(text);
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }

        const fresh = migratedDatabase();
        await restoreArchive(fresh, parsed);

        const rows = await fresh.select().from(transactions);
        expect(rows).toHaveLength(1);
        expect(rows[0].note).toBe("coffee");
        expect(rows[0].amount).toBe(12.5);
    });

    it("round-trips an account and the entry that names it", async () => {
        await db.insert(categories).values(CATEGORY);
        await db.insert(accounts).values({
            currency: "EUR",
            dateCreated: new Date(1_700_000_000_000),
            id: "a1",
            initialBalance: 250,
            initialBalanceDate: new Date(1_700_000_000_000),
            initialBalanceUsd: 270,
            name: "Checking",
            updatedAt: new Date(1_700_000_000_000),
        });
        await db.insert(transactions).values(transactionRow("t1", { accountId: "a1" }));

        const parsed = parseArchive(serializeArchive(await buildArchive(db, new Date())));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }
        const fresh = migratedDatabase();
        await restoreArchive(fresh, parsed);

        const [account] = await fresh.select().from(accounts);
        expect(account.name).toBe("Checking");
        expect(account.initialBalance).toBe(250);
        expect(account.initialBalanceDate.getTime()).toBe(1_700_000_000_000);
        const [row] = await fresh.select().from(transactions);
        expect(row.accountId).toBe("a1");
    });

    it("restores an instant as the same moment, not as text", async () => {
        // The defect this guards: JSON turns a Date into an ISO string, and a
        // column read back as a string sorts and compares differently from every
        // other date in the ledger.
        const when = new Date(1_700_000_123_456);
        await db.insert(categories).values(CATEGORY);
        await db.insert(transactions).values(transactionRow("t1", { date: when }));

        const parsed = parseArchive(serializeArchive(await buildArchive(db, when)));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }
        const fresh = migratedDatabase();
        await restoreArchive(fresh, parsed);

        const [row] = await fresh.select().from(transactions);
        expect(row.date instanceof Date).toBeTruthy();
        expect(row.date.getTime()).toBe(when.getTime());
    });

    it("carries a tombstone rather than dropping it", async () => {
        // A deletion the archive dropped comes back as a live row the moment a peer
        // that never saw it pushes again.
        await db.insert(categories).values(CATEGORY);
        await db.insert(transactions).values(transactionRow("t1", { deletedAt: new Date(1_700_000_000_000) }));

        const parsed = parseArchive(serializeArchive(await buildArchive(db, new Date())));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }
        const fresh = migratedDatabase();
        await restoreArchive(fresh, parsed);

        const [row] = await fresh.select().from(transactions);
        expect(row.deletedAt instanceof Date).toBeTruthy();
    });

    it("replaces the ledger rather than merging into it", async () => {
        await db.insert(categories).values(CATEGORY);
        await db.insert(transactions).values(transactionRow("t1"));
        const parsed = parseArchive(serializeArchive(await buildArchive(db, new Date())));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }

        const target = migratedDatabase();
        await target.insert(categories).values(CATEGORY);
        await target.insert(transactions).values(transactionRow("t2"));
        await restoreArchive(target, parsed);

        const rows = await target.select().from(transactions);
        expect(rows.map((row) => row.id)).toStrictEqual(["t1"]);
    });

    it("restores a ledger larger than one insert can bind", async () => {
        await db.insert(categories).values(CATEGORY);
        for (let i = 0; i < 250; i += 1) {
            await db.insert(transactions).values(transactionRow(`t${i}`));
        }

        const parsed = parseArchive(serializeArchive(await buildArchive(db, new Date())));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }
        const fresh = migratedDatabase();
        const written = await restoreArchive(fresh, parsed);

        expect(written).toBe(251);
        await expect(fresh.select().from(transactions)).resolves.toHaveLength(250);
    });

    it("writes categories before the rows that point at them", async () => {
        // Reversing the order fails the foreign key, which better-sqlite3 enforces.
        await db.insert(categories).values(CATEGORY);
        await db.insert(transactions).values(transactionRow("t1"));
        const parsed = parseArchive(serializeArchive(await buildArchive(db, new Date())));
        if (!parsed) {
            throw new Error("expected the archive to parse");
        }

        const fresh = migratedDatabase();
        await restoreArchive(fresh, parsed);
    });
});

describe("archive and the device's own state", () => {
    // `appMeta` holds this phone's identity next to the account's settings, and
    // `replaceLocalFromAccount` refuses to wipe the table for exactly this
    // reason: "Wiping the table would take `syncDeviceId`, `syncCursor` and
    // `onboardingComplete` with it — device state that no pull will ever hand
    // back."
    it("leaves this device's sync identity alone through a restore", async () => {
        const source = migratedDatabase();
        await setMeta(source, META_KEYS.currency, "EUR");
        await setMeta(source, META_KEYS.syncDeviceId, "device-from-the-iphone");
        await setMeta(source, META_KEYS.syncCursor, "5000");
        const document = await buildArchive(source, new Date());

        const target = migratedDatabase();
        await setMeta(target, META_KEYS.currency, "USD");
        await setMeta(target, META_KEYS.syncDeviceId, "device-on-the-ipad");
        await setMeta(target, META_KEYS.syncCursor, "200");

        await restoreArchive(target, document);

        // The account's settings travel.
        await expect(getMeta(target, META_KEYS.currency)).resolves.toBe("EUR");
        // The device's do not — a stolen device id breaks the same-millisecond
        // tie-break between the two handsets, and a cursor that jumped forward
        // skips every sequence in between, permanently.
        await expect(getMeta(target, META_KEYS.syncDeviceId)).resolves.toBe("device-on-the-ipad");
        await expect(getMeta(target, META_KEYS.syncCursor)).resolves.toBe("200");
    });

    it("does not carry the device keys into the file at all", async () => {
        const db = migratedDatabase();
        await setMeta(db, META_KEYS.syncDeviceId, "device-from-the-iphone");

        const document = await buildArchive(db, new Date());

        expect(JSON.stringify(document.tables.appMeta)).not.toContain("device-from-the-iphone");
    });
});
