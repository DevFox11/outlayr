import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { accounts, budgets, categories, mainBudget, transactions } from "@/db/schema";
import { testDatabase } from "@/db/test-database";

import { getMeta, META_KEYS } from "./app-meta-core";
import { seedCategories } from "./categories-core";
import {
    adoptedAccount,
    completeAdoption,
    localLedgerState,
    markAdopted,
    prepareAccountAdoption,
    runAdoption,
} from "./ledger-adoption";
import type { AdoptionEngine } from "./ledger-adoption";
import {
    getSyncCursor,
    getSyncedAt,
    isSyncEnabled,
    outboxPendingCount,
    setSyncAccountSubject,
    setSyncCursor,
    setSyncEnabled,
    setSyncedAt,
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
    return testDatabase(sqlite);
}

async function addTransaction(target: Database, id: string, deletedAt: Date | null = null): Promise<void> {
    const now = new Date();
    await target.insert(transactions).values({
        amount: 12,
        date: now,
        day: now,
        deletedAt,
        id,
        income: false,
        month: now,
        updatedAt: now,
    });
}

let db: Database;

beforeEach(async () => {
    db = makeDb();
    await seedCategories(db);
});

describe("local ledger state", () => {
    it("reads a freshly seeded install as empty", async () => {
        await expect(localLedgerState(db)).resolves.toBe("empty");
    });

    it("errs toward populated on an install that was never seeded", async () => {
        const bare = makeDb();
        await expect(localLedgerState(bare)).resolves.toBe("populated");
    });

    it("reads a single transaction as populated", async () => {
        await addTransaction(db, "t1");
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads a transaction deleted offline as populated", async () => {
        await addTransaction(db, "t1", new Date());
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads a budget as populated", async () => {
        const [first] = await db.select().from(categories).limit(1);
        await db.insert(budgets).values({
            amount: 100,
            categoryId: first?.id ?? null,
            id: "b1",
            type: 0,
            updatedAt: new Date(),
        });
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads a main budget as populated", async () => {
        await db.insert(mainBudget).values({ amount: 100, id: "m1", type: 0, updatedAt: new Date() });
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads an account as populated", async () => {
        const now = new Date();
        await db.insert(accounts).values({
            currency: "USD",
            dateCreated: now,
            id: "a1",
            initialBalanceDate: now,
            name: "Checking",
            updatedAt: now,
        });
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads a renamed category as populated", async () => {
        const [first] = await db.select().from(categories).limit(1);
        await db
            .update(categories)
            .set({ name: "Renamed", updatedAt: new Date(Date.now() + 1000) })
            .where(eq(categories.id, first?.id ?? ""));
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads a deleted category as populated", async () => {
        const [first] = await db.select().from(categories).limit(1);
        await db
            .update(categories)
            .set({ deletedAt: new Date() })
            .where(eq(categories.id, first?.id ?? ""));
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });

    it("reads an added category as populated", async () => {
        const now = new Date();
        await db.insert(categories).values({
            dateCreated: now,
            id: "c-new",
            name: "Mine",
            updatedAt: now,
        });
        await expect(localLedgerState(db)).resolves.toBe("populated");
    });
});

describe("adoption marker", () => {
    it("is absent before any account has been reconciled", async () => {
        await expect(adoptedAccount(db)).resolves.toBeNull();
    });

    it("holds the account it was resolved for", async () => {
        await markAdopted(db, "user_a");
        await expect(adoptedAccount(db)).resolves.toBe("user_a");
    });

    it("account-switch-clears-metadata-before-enable", async () => {
        await markAdopted(db, "account-a");
        await runAdoption(db, null, { pushLocal: false, wipeAccount: false, wipeLocal: false });
        await setSyncCursor(db, 23);
        await setSyncedAt(db, new Date(1_700_000_000_000));
        await addTransaction(db, "queued-for-account-a");

        await prepareAccountAdoption(db, "account-b");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(getSyncCursor(db)).resolves.toBe(0);
        await expect(getSyncedAt(db)).resolves.toBeNull();
        await expect(outboxPendingCount(db)).resolves.toBe(0);
        await expect(adoptedAccount(db)).resolves.toBe("account-a");
    });

    it("unmarked-residual-sync-state-is-cleared-before-new-account-adoption", async () => {
        await setSyncEnabled(db, true);
        await setSyncCursor(db, 23);
        await setSyncedAt(db, new Date(1_700_000_000_000));
        await addTransaction(db, "queued-without-marker");

        await prepareAccountAdoption(db, "account-b");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(getSyncCursor(db)).resolves.toBe(0);
        await expect(getSyncedAt(db)).resolves.toBeNull();
        await expect(outboxPendingCount(db)).resolves.toBe(0);
    });

    it("unmarked-bound-subject-preserves-explicit-sync-off", async () => {
        await setSyncAccountSubject(db, "account-a");

        await prepareAccountAdoption(db, "account-a");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBe("account-a");
    });

    it("mismatched-marker-and-metadata-cannot-preserve-queued-writes", async () => {
        await markAdopted(db, "account-a");
        await setSyncAccountSubject(db, "account-b");
        await setSyncEnabled(db, true);
        await addTransaction(db, "queued-for-mismatched-subject");

        await prepareAccountAdoption(db, "account-b");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(outboxPendingCount(db)).resolves.toBe(0);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBeNull();
    });

    it("is replaced when a different account signs in", async () => {
        await markAdopted(db, "user_a");
        await markAdopted(db, "user_b");
        await expect(adoptedAccount(db)).resolves.toBe("user_b");
    });
});

function recordingEngine(): AdoptionEngine & { calls: string[] } {
    const calls: string[] = [];
    return {
        accountLedger: async () => {
            calls.push("accountLedger");
            return "populated";
        },
        calls,
        discardAccountLedger: async () => {
            calls.push("discardAccountLedger");
        },
        replaceFromAccount: async () => {
            calls.push("replaceFromAccount");
        },
    };
}

describe("running an adoption", () => {
    it("opens the sync gate without queueing when there is nothing to push", async () => {
        await runAdoption(db, null, { pushLocal: false, wipeAccount: false, wipeLocal: false }, "account-a");
        await expect(isSyncEnabled(db)).resolves.toBe(true);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBe("account-a");
        await expect(outboxPendingCount(db)).resolves.toBe(0);
    });

    it("queues every local row when adopting", async () => {
        await addTransaction(db, "t1");
        await runAdoption(db, null, {
            pushLocal: true,
            wipeAccount: false,
            wipeLocal: false,
        });
        await expect(isSyncEnabled(db)).resolves.toBe(true);
        expect((await outboxPendingCount(db)) > 1).toBeTruthy();
    });

    it("rolls back tentative account sync when enqueue fails", async () => {
        await setSyncCursor(db, 23);
        await setSyncedAt(db, new Date(1_700_000_000_000));
        await addTransaction(db, "t1");
        (db.$client as unknown as { exec: (sql: string) => void }).exec(`
			CREATE TRIGGER fail_outbox_enqueue BEFORE INSERT ON outbox
			BEGIN SELECT RAISE(ABORT, 'queue unavailable'); END;
		`);

        await expect(
            runAdoption(
                db,
                null,
                {
                    pushLocal: true,
                    wipeAccount: false,
                    wipeLocal: false,
                },
                "account-a"
            )
        ).rejects.toThrow("queue unavailable");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBeNull();
        await expect(outboxPendingCount(db)).resolves.toBe(0);
        await expect(getSyncCursor(db)).resolves.toBe(0);
        await expect(getSyncedAt(db)).resolves.toBeNull();
        await expect(adoptedAccount(db)).resolves.toBeNull();
    });

    it("preserves an already-enabled same-subject sync state when enqueue fails", async () => {
        await runAdoption(db, null, { pushLocal: false, wipeAccount: false, wipeLocal: false }, "account-a");
        (db.$client as unknown as { exec: (sql: string) => void }).exec(`
			CREATE TRIGGER fail_outbox_enqueue BEFORE INSERT ON outbox
			BEGIN SELECT RAISE(ABORT, 'queue unavailable'); END;
		`);

        await expect(
            runAdoption(
                db,
                null,
                {
                    pushLocal: true,
                    wipeAccount: false,
                    wipeLocal: false,
                },
                "account-a"
            )
        ).rejects.toThrow("queue unavailable");

        await expect(isSyncEnabled(db)).resolves.toBe(true);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBe("account-a");
    });

    it("rolls back tentative account sync when marker persistence fails", async () => {
        await expect(
            completeAdoption(
                db,
                null,
                { pushLocal: false, wipeAccount: false, wipeLocal: false },
                "account-a",
                async () => {
                    throw new Error("marker unavailable");
                }
            )
        ).rejects.toThrow("marker unavailable");

        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(getMeta(db, META_KEYS.syncAccountSubject)).resolves.toBeNull();
        await expect(outboxPendingCount(db)).resolves.toBe(0);
        await expect(getSyncCursor(db)).resolves.toBe(0);
        await expect(getSyncedAt(db)).resolves.toBeNull();
        await expect(adoptedAccount(db)).resolves.toBeNull();
    });

    it("refuses a destructive plan with no engine to run it through", async () => {
        await expect(
            runAdoption(db, null, {
                pushLocal: false,
                wipeAccount: false,
                wipeLocal: true,
            })
        ).rejects.toThrow();
        await expect(
            runAdoption(db, null, {
                pushLocal: true,
                wipeAccount: true,
                wipeLocal: false,
            })
        ).rejects.toThrow();
        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(outboxPendingCount(db)).resolves.toBe(0);
    });

    it("refills from the account before the gate opens, so the wipe queues nothing", async () => {
        await addTransaction(db, "t1");
        const engine = recordingEngine();
        engine.replaceFromAccount = async () => {
            engine.calls.push("replaceFromAccount");
            await expect(isSyncEnabled(db)).resolves.toBe(false);
        };
        await runAdoption(db, engine, {
            pushLocal: false,
            wipeAccount: false,
            wipeLocal: true,
        });
        expect(engine.calls).toStrictEqual(["replaceFromAccount"]);
        await expect(isSyncEnabled(db)).resolves.toBe(true);
        await expect(outboxPendingCount(db)).resolves.toBe(0);
    });

    it("discards the account's ledger before queueing this device's", async () => {
        await addTransaction(db, "t1");
        const engine = recordingEngine();
        await runAdoption(db, engine, {
            pushLocal: true,
            wipeAccount: true,
            wipeLocal: false,
        });
        expect(engine.calls).toStrictEqual(["discardAccountLedger"]);
        expect((await outboxPendingCount(db)) > 1).toBeTruthy();
    });

    it("leaves both sides untouched when the engine refuses", async () => {
        await addTransaction(db, "t1");
        const engine = recordingEngine();
        engine.discardAccountLedger = async () => {
            throw new Error("offline");
        };
        await expect(
            runAdoption(db, engine, {
                pushLocal: true,
                wipeAccount: true,
                wipeLocal: false,
            })
        ).rejects.toThrow();
        await expect(isSyncEnabled(db)).resolves.toBe(false);
        await expect(outboxPendingCount(db)).resolves.toBe(0);
    });
});
