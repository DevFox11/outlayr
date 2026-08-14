import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { accounts, categories, transactions } from "@/db/schema";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import {
    enqueueAllForSync,
    getOrCreateDeviceId,
    getSyncCursor,
    isSyncEnabled,
    outboxPendingCount,
    SYNCED_META_KEYS,
    setSyncCursor,
    setSyncEnabled,
} from "./sync-outbox-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

function makeDb(): Database {
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
    return drizzle(sqlite) as unknown as Database;
}

async function addTransaction(db: Database, id: string): Promise<void> {
    await db.insert(transactions).values({
        amount: 1,
        date: new Date(1),
        day: new Date(1),
        id,
        income: false,
        month: new Date(1),
        updatedAt: new Date(1),
    });
}

describe("sync device identity", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
    });

    it("mints a device id once and keeps it", async () => {
        const first = await getOrCreateDeviceId(db);

        expect(first).toMatch(/^[0-9a-f-]{36}$/);
        expect(await getOrCreateDeviceId(db)).toBe(first);
        expect(await getMeta(db, META_KEYS.syncDeviceId)).toBe(first);
    });

    it("never queues the device id for replication", async () => {
        await setSyncEnabled(db, true);
        await getOrCreateDeviceId(db);

        expect(await outboxPendingCount(db)).toBe(0);
    });
});

describe("sync cursor", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
    });

    it("starts at zero", async () => {
        expect(await getSyncCursor(db)).toBe(0);
    });

    it("round-trips", async () => {
        await setSyncCursor(db, 4218);

        expect(await getSyncCursor(db)).toBe(4218);
    });

    it("falls back to zero rather than replaying from a corrupt cursor", async () => {
        await setMeta(db, META_KEYS.syncCursor, "not-a-number");

        expect(await getSyncCursor(db)).toBe(0);
    });

    it("never queues the cursor for replication", async () => {
        await setSyncEnabled(db, true);
        await setSyncCursor(db, 7);

        expect(await outboxPendingCount(db)).toBe(0);
    });
});

describe("the sync gate", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
    });

    it("is off until something turns it on", async () => {
        expect(await isSyncEnabled(db)).toBe(false);

        await addTransaction(db, "t1");

        expect(await outboxPendingCount(db)).toBe(0);
    });

    it("queues writes once it is on", async () => {
        await setSyncEnabled(db, true);

        expect(await isSyncEnabled(db)).toBe(true);

        await addTransaction(db, "t1");

        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("empties the queue when it is turned back off", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1");

        await setSyncEnabled(db, false);

        expect(await outboxPendingCount(db)).toBe(0);

        await addTransaction(db, "t2");

        expect(await outboxPendingCount(db)).toBe(0);
    });
});

describe("enqueueAllForSync", () => {
    let db: Database;

    beforeEach(() => {
        db = makeDb();
    });

    it("queues rows written before the gate opened, tombstones included", async () => {
        await addTransaction(db, "t1");
        await db.insert(transactions).values({
            amount: 0,
            date: new Date(1),
            day: new Date(1),
            deletedAt: new Date(2),
            id: "gone",
            income: false,
            month: new Date(1),
            updatedAt: new Date(1),
        });
        await db.insert(categories).values({ id: "c1", updatedAt: new Date(1) });
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: new Date(1),
            id: "a1",
            initialBalanceDate: new Date(1),
            name: "Checking",
            updatedAt: new Date(1),
        });

        await setSyncEnabled(db, true);
        await enqueueAllForSync(db);

        expect(await outboxPendingCount(db)).toBe(4);
    });

    it("queues only account-scoped meta keys", async () => {
        // Both registries: META_KEYS holds the app's own markers, while the synced
        // presentation settings are stored under their bare setting names and so
        // appear in neither. Seeding only one of them would let the allow-list grow
        // without this ever noticing.
        for (const key of [...Object.values(META_KEYS), ...SYNCED_META_KEYS]) {
            await setMeta(db, key, "x");
        }

        await enqueueAllForSync(db);

        expect(await outboxPendingCount(db)).toBe(SYNCED_META_KEYS.length);
    });

    it("is idempotent", async () => {
        await addTransaction(db, "t1");

        await enqueueAllForSync(db);
        await enqueueAllForSync(db);

        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("queues a ledger larger than one insert can bind", async () => {
        for (let i = 0; i < 420; i += 1) {
            await addTransaction(db, `t${i}`);
        }

        await enqueueAllForSync(db);

        expect(await outboxPendingCount(db)).toBe(420);
    });
});
