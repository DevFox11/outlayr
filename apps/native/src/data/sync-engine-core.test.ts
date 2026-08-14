import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

import type { Database } from "@/db/client";
import { accounts, budgets, categories, mainBudget, outbox, transactions } from "@/db/schema";

import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { applyPulledRows, drainOutbox, incomingWinsLocally, pullAndApply, runSync, specFor } from "./sync-engine-core";
import type { PulledRow, PushFn, WireRow } from "./sync-engine-core";
import { getSyncCursor, outboxPendingCount, SYNCED_TABLES, setSyncEnabled } from "./sync-outbox-core";

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
    // Matches `db/client.ts` on a store that checks out clean. Without it the
    // applier's `PRAGMA foreign_keys = OFF` would be a no-op here and the
    // out-of-order page below would pass for the wrong reason.
    sqlite.exec("PRAGMA foreign_keys = ON");
    return drizzle(sqlite) as unknown as Database;
}

/**
 * A minimal server: one seq counter, one row per `(table, localId)`, and the
 * same R1/R2 rule `packages/backend/convex/sync.ts` applies. It exists so the
 * device-side tests can exercise a real round trip; the Convex handler is
 * tested against `convex-test` in `packages/backend/convex/sync.test.ts`.
 */
function makeServer() {
    const rows = new Map<string, PulledRow>();
    let nextSeq = 1;

    const wins = (
        incoming: { updatedAt: number; deletedAt: number | null; deviceId: string },
        existing: PulledRow | undefined
    ): boolean => {
        if (!existing) {
            return true;
        }
        const a = incoming.deletedAt !== null;
        const b = existing.deletedAt !== null;
        if (a !== b) {
            return a;
        }
        if (incoming.updatedAt !== existing.updatedAt) {
            return incoming.updatedAt > existing.updatedAt;
        }
        return incoming.deviceId > existing.deviceId;
    };

    const push: PushFn = async ({ deviceId, rows: pushed }) => {
        let accepted = 0;
        let skipped = 0;
        for (const row of pushed) {
            const key = `${row.table} ${row.localId}`;
            const existing = rows.get(key);
            if (!wins({ ...row, deviceId }, existing)) {
                skipped += 1;
                continue;
            }
            rows.set(key, { ...row, deviceId, seq: nextSeq });
            nextSeq += 1;
            accepted += 1;
        }
        return { accepted, nextSeq, skipped };
    };

    const pull = async ({ cursor, limit }: { cursor: number; limit: number }) => {
        const after = [...rows.values()].filter((row) => row.seq > cursor).sort((a, b) => a.seq - b.seq);
        const page = after.slice(0, limit);
        return {
            cursor: page.at(-1)?.seq ?? cursor,
            hasMore: after.length > page.length,
            rows: page,
        };
    };

    return { pull, push, rows, transport: { pull, push } };
}

const AT = (ms: number) => new Date(ms);

const eqId = (id: string) => eq(transactions.id, id);

async function addTransaction(
    db: Database,
    id: string,
    overrides: Partial<typeof transactions.$inferInsert> = {}
): Promise<void> {
    await db.insert(transactions).values({
        amount: 10,
        date: AT(1000),
        day: AT(1000),
        id,
        income: false,
        month: AT(1000),
        note: id,
        updatedAt: AT(1000),
        ...overrides,
    });
}

function txRow(
    localId: string,
    seq: number,
    updatedAt: number,
    overrides: {
        deletedAt?: number | null;
        deviceId?: string;
        fields?: Record<string, unknown>;
    } = {}
): PulledRow {
    return {
        deletedAt: overrides.deletedAt ?? null,
        deviceId: overrides.deviceId ?? "device-b",
        fields: {
            amount: 10,
            amountUsd: null,
            categoryId: null,
            currency: null,
            customColor: null,
            date: 1000,
            day: 1000,
            details: null,
            emoji: null,
            exchangeRate: null,
            exchangeRateType: null,
            icon: null,
            imageColor: null,
            imageUri: null,
            income: false,
            month: 1000,
            note: localId,
            onceRecurring: false,
            recurringCoefficient: 1,
            recurringEndDate: null,
            recurringType: 0,
            ...overrides.fields,
        },
        localId,
        seq,
        table: "transactions",
        updatedAt,
    };
}

function metaRow(key: string, seq: number, updatedAt: number, value: string | null): PulledRow {
    return {
        deletedAt: null,
        deviceId: "device-b",
        fields: { value },
        localId: key,
        seq,
        table: "appMeta",
        updatedAt,
    };
}

describe("the replicated column set", () => {
    // A column added to the local schema and not to the spec replicates as
    // permanently absent rather than as an error, which no round-trip test would
    // notice on its own.
    const ENVELOPE = new Set(["id", "key", "updatedAt", "deletedAt"]);
    /** Columns whose value is about this handset, not about the ledger. */
    const DEVICE_LOCAL = new Set([
        "transactions.imageUri",
        // Every handset schedules its own local notification off its own copy of the
        // schedule, so replicating the preference would only share a choice the
        // receiving device already gets to make.
        "transactions.reminderLeadDays",
        // The path embeds a container uuid that changes on every app update, so it
        // is meaningless on another handset and stale on this one after one.
        "transactionPhotos.imageUri",
        "accounts.imageUri",
    ]);

    for (const table of SYNCED_TABLES) {
        it(`covers every column of ${table}`, () => {
            const spec = specFor(table);
            const declared = Object.keys(getTableColumns(spec.table)).filter(
                (name) => !(ENVELOPE.has(name) || DEVICE_LOCAL.has(`${table}.${name}`))
            );

            expect([...spec.fields].sort()).toStrictEqual(declared.sort());
        });
    }

    // Replicating it lost photos: the receiver could not resolve the sender's
    // container path, its reconciliation nulled the column, and the push that
    // followed tie-broke on `deviceId` back onto the sender.
    it("never replicates a device-local path", () => {
        expect(!specFor("transactions").fields.includes("imageUri")).toBeTruthy();
        expect(specFor("transactions").fields.includes("imageKey")).toBeTruthy();
    });

    it("names only real timestamp columns as dates", () => {
        for (const table of SYNCED_TABLES) {
            const spec = specFor(table);
            for (const name of spec.dates) {
                expect(spec.fields.includes(name)).toBeTruthy();
            }
        }
    });
});

describe("incomingWinsLocally", () => {
    it("takes anything when there is no local row", () => {
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 1 }, null, false)).toBe(true);
    });

    it("r1 — a tombstone is absorbing in both directions", () => {
        expect(incomingWinsLocally({ deletedAt: 1, updatedAt: 1 }, { deletedAt: null, updatedAt: 999 }, false)).toBe(
            true
        );
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 999 }, { deletedAt: 1, updatedAt: 1 }, false)).toBe(
            false
        );
    });

    it("r2 — the greater updatedAt takes the row", () => {
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 2 }, { deletedAt: null, updatedAt: 1 }, false)).toBe(
            true
        );
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 1 }, { deletedAt: null, updatedAt: 2 }, false)).toBe(
            false
        );
    });

    it("keeps an unsent local edit on an exact tie", () => {
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 5 }, { deletedAt: null, updatedAt: 5 }, true)).toBe(
            false
        );
        expect(incomingWinsLocally({ deletedAt: null, updatedAt: 5 }, { deletedAt: null, updatedAt: 5 }, false)).toBe(
            true
        );
    });
});

describe("drainOutbox", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("pushes nothing while the gate is shut", async () => {
        await addTransaction(db, "t1");
        let calls = 0;
        const push: PushFn = async () => {
            calls += 1;
            return { accepted: 0, nextSeq: 1, skipped: 0 };
        };

        expect(await drainOutbox(db, push)).toBe(0);
        expect(calls).toBe(0);
    });

    it("pushes queued rows and clears exactly what it sent", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1");
        await addTransaction(db, "t2");
        const server = makeServer();

        expect(await drainOutbox(db, server.push)).toBe(2);
        expect(await outboxPendingCount(db)).toBe(0);
        expect(server.rows.size).toBe(2);
    });

    it("carries the row's own values, dates as epoch milliseconds", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1", {
            amount: 42.5,
            date: AT(5000),
            note: "lunch",
            updatedAt: AT(7000),
        });
        let seen: WireRow[] = [];
        await drainOutbox(db, async ({ rows }) => {
            seen = rows;
            return { accepted: rows.length, nextSeq: 1, skipped: 0 };
        });

        expect(seen[0].table).toBe("transactions");
        expect(seen[0].updatedAt).toBe(7000);
        expect(seen[0].deletedAt).toBeNull();
        expect(seen[0].fields.amount).toBe(42.5);
        expect(seen[0].fields.note).toBe("lunch");
        expect(seen[0].fields.date).toBe(5000);
        expect(seen[0].fields.categoryId).toBeNull();
    });

    it("round-trips resolved and pending custom transaction rate triples", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "resolved-custom", {
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        await addTransaction(db, "pending-custom", {
            amountUsd: null,
            exchangeRate: null,
            exchangeRateType: "custom",
        });
        let wireRows: WireRow[] = [];
        await drainOutbox(db, async ({ rows }) => {
            wireRows = rows;
            return { accepted: rows.length, nextSeq: rows.length, skipped: 0 };
        });

        const target = makeDb();
        await applyPulledRows(target, {
            cursor: wireRows.length,
            rows: wireRows.map((row, index) => ({ ...row, deviceId: "device-a", seq: index + 1 })),
        });
        const replicated = await target.select().from(transactions);
        expect(replicated.find((row) => row.id === "resolved-custom")).toMatchObject({
            amountUsd: 1.801802,
            exchangeRate: 55.5,
            exchangeRateType: "custom",
        });
        expect(replicated.find((row) => row.id === "pending-custom")).toMatchObject({
            amountUsd: null,
            exchangeRate: null,
            exchangeRateType: "custom",
        });
    });

    it("pushes a tombstone as one", async () => {
        await addTransaction(db, "t1");
        await setSyncEnabled(db, true);
        await db
            .update(transactions)
            .set({ deletedAt: AT(9000), updatedAt: AT(9000) })
            .where(eqId("t1"));
        let seen: WireRow[] = [];
        await drainOutbox(db, async ({ rows }) => {
            seen = rows;
            return { accepted: rows.length, nextSeq: 1, skipped: 0 };
        });

        expect(seen[0].deletedAt).toBe(9000);
    });

    it("leaves an edit that arrived mid-flight queued", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1");
        const push: PushFn = async ({ rows }) => {
            await db
                .update(transactions)
                .set({ note: "edited", updatedAt: AT(2000) })
                .where(eqId("t1"));
            return { accepted: rows.length, nextSeq: 1, skipped: 0 };
        };

        await drainOutbox(db, push);

        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("pages a queue longer than one batch", async () => {
        await setSyncEnabled(db, true);
        for (let i = 0; i < 501; i += 1) {
            await addTransaction(db, `t${i}`);
        }
        const batches: number[] = [];
        await drainOutbox(db, async ({ rows }) => {
            batches.push(rows.length);
            return { accepted: rows.length, nextSeq: 1, skipped: 0 };
        });

        expect(batches).toStrictEqual([500, 1]);
        expect(await outboxPendingCount(db)).toBe(0);
    });

    it("keeps the queue when the push throws", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1");

        await expect(
            drainOutbox(db, async () => {
                throw new Error("offline");
            })
        ).rejects.toThrow();
        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("pushes only the account-scoped meta keys", async () => {
        await setSyncEnabled(db, true);
        await setMeta(db, META_KEYS.currency, "EUR");
        await setMeta(db, META_KEYS.firstLaunch, "0");
        let seen: WireRow[] = [];
        await drainOutbox(db, async ({ rows }) => {
            seen = rows;
            return { accepted: rows.length, nextSeq: 1, skipped: 0 };
        });

        expect(seen.map((row) => row.localId)).toStrictEqual([META_KEYS.currency]);
        expect(seen[0].fields.value).toBe("EUR");
        expect(seen[0].deletedAt).toBeNull();
    });
});

describe("applyPulledRows", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("inserts a row this device has never seen", async () => {
        const result = await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("remote", 1, 5000, { fields: { amount: 7.5 } })],
        });

        const [row] = await db.select().from(transactions);
        expect(result.applied).toBe(1);
        expect(row.id).toBe("remote");
        expect(row.amount).toBe(7.5);
        expect(row.updatedAt.getTime()).toBe(5000);
        expect(await getSyncCursor(db)).toBe(1);
    });

    it("round-trips dates and nulls", async () => {
        await applyPulledRows(db, {
            cursor: 1,
            rows: [
                txRow("remote", 1, 5000, {
                    fields: { date: 111, day: 222, month: 333, recurringEndDate: null },
                }),
            ],
        });

        const [row] = await db.select().from(transactions);
        expect(row.date.getTime()).toBe(111);
        expect(row.day.getTime()).toBe(222);
        expect(row.month.getTime()).toBe(333);
        expect(row.recurringEndDate).toBeNull();
        expect(row.deletedAt).toBeNull();
    });

    it("overwrites a local row the incoming one outranks", async () => {
        await addTransaction(db, "t1", { note: "mine", updatedAt: AT(1000) });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 9000, { fields: { note: "theirs" } })],
        });

        const [row] = await db.select().from(transactions);
        expect(row.note).toBe("theirs");
    });

    it("keeps a newer local row and does not clear its queue entry", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1", { note: "mine", updatedAt: AT(9000) });

        const result = await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 1000, { fields: { note: "theirs" } })],
        });

        const [row] = await db.select().from(transactions);
        expect(result.applied).toBe(0);
        expect(row.note).toBe("mine");
        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("r1 — an incoming tombstone beats a newer local edit", async () => {
        await addTransaction(db, "t1", { updatedAt: AT(9000) });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 1000, { deletedAt: 1000 })],
        });

        const [row] = await db.select().from(transactions);
        expect(row.deletedAt?.getTime()).toBe(1000);
    });

    it("r1 — a local tombstone is not resurrected by a newer incoming edit", async () => {
        await addTransaction(db, "t1", {
            deletedAt: AT(1000),
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 9000, { fields: { note: "back" } })],
        });

        const [row] = await db.select().from(transactions);
        expect(row.deletedAt?.getTime()).toBe(1000);
        expect(row.note).not.toBe("back");
    });

    // `reminderLeadDays` is device-local, so it is absent from the wire and the
    // applier's `onConflictDoUpdate` leaves whatever this handset stored. On a row
    // a peer has settled that would be a live notice for a charge already taken.
    it("clears the local notice when a peer retires the schedule", async () => {
        await addTransaction(db, "t1", {
            onceRecurring: true,
            recurringType: 3,
            reminderLeadDays: 3,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [
                txRow("t1", 1, 9000, {
                    fields: { onceRecurring: true, recurringType: 0 },
                }),
            ],
        });

        const [row] = await db.select().from(transactions);
        expect(row.reminderLeadDays).toBeNull();
    });

    it("clears the local notice when a peer deletes the row", async () => {
        await addTransaction(db, "t1", {
            onceRecurring: true,
            recurringType: 3,
            reminderLeadDays: 3,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 9000, { deletedAt: 9000 })],
        });

        const [row] = await db.select().from(transactions);
        expect(row.reminderLeadDays).toBeNull();
    });

    it("keeps the local notice when a peer edits the live carrier", async () => {
        await addTransaction(db, "t1", {
            onceRecurring: true,
            recurringType: 3,
            reminderLeadDays: 3,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [
                txRow("t1", 1, 9000, {
                    fields: { note: "theirs", onceRecurring: true, recurringType: 3 },
                }),
            ],
        });

        const [row] = await db.select().from(transactions);
        expect(row.note).toBe("theirs");
        expect(row.reminderLeadDays).toBe(3);
    });

    it("keeps an unsent local edit on an exact updatedAt tie", async () => {
        await setSyncEnabled(db, true);
        await addTransaction(db, "t1", { note: "mine", updatedAt: AT(5000) });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("t1", 1, 5000, { fields: { note: "theirs" } })],
        });

        const [row] = await db.select().from(transactions);
        expect(row.note).toBe("mine");
        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("deletes the queue entries its own writes create", async () => {
        await setSyncEnabled(db, true);

        await applyPulledRows(db, {
            cursor: 1,
            rows: [txRow("remote", 1, 5000)],
        });

        expect(await outboxPendingCount(db)).toBe(0);
    });

    it("applies a page whose transaction precedes the category it references", async () => {
        const category: PulledRow = {
            deletedAt: null,
            deviceId: "device-b",
            fields: {
                color: "#FFFFFF",
                dateCreated: null,
                emoji: null,
                icon: null,
                income: false,
                name: "Bills",
                parentId: null,
                sortOrder: 0,
            },
            localId: "c1",
            seq: 2,
            table: "categories",
            updatedAt: 6000,
        };

        const result = await applyPulledRows(db, {
            cursor: 2,
            rows: [txRow("t1", 1, 5000, { fields: { categoryId: "c1" } }), category],
        });

        expect(result.applied).toBe(2);
        const [row] = await db.select().from(transactions);
        expect(row.categoryId).toBe("c1");
    });

    it("advances the cursor only as far as the page reached", async () => {
        await applyPulledRows(db, { cursor: 1, rows: [txRow("t1", 1, 5000)] });
        await applyPulledRows(db, { cursor: 7, rows: [txRow("t2", 7, 5000)] });

        expect(await getSyncCursor(db)).toBe(7);
    });

    it("leaves the cursor alone on an empty page", async () => {
        await applyPulledRows(db, { cursor: 99, rows: [] });

        expect(await getSyncCursor(db)).toBe(0);
    });

    it("writes an appMeta key by its key", async () => {
        await applyPulledRows(db, {
            cursor: 1,
            rows: [
                {
                    deletedAt: null,
                    deviceId: "device-b",
                    fields: { value: "JPY" },
                    localId: META_KEYS.currency,
                    seq: 1,
                    table: "appMeta",
                    updatedAt: 5000,
                },
            ],
        });

        expect(await getMeta(db, META_KEYS.currency)).toBe("JPY");
    });

    // `appMeta` carries no `updatedAt` column, so without the pending guard every
    // incoming value would outrank a local one the device has not sent yet.
    it("keeps an unsent local meta value rather than taking the incoming one", async () => {
        await setSyncEnabled(db, true);
        await setMeta(db, META_KEYS.currency, "GBP");

        await applyPulledRows(db, {
            cursor: 1,
            rows: [metaRow(META_KEYS.currency, 1, 9000, "JPY")],
        });

        expect(await getMeta(db, META_KEYS.currency)).toBe("GBP");
        expect(await outboxPendingCount(db)).toBe(1);
    });

    it("takes the incoming meta value when nothing local is owed", async () => {
        await setMeta(db, META_KEYS.currency, "GBP");

        await applyPulledRows(db, {
            cursor: 1,
            rows: [metaRow(META_KEYS.currency, 1, 9000, "JPY")],
        });

        expect(await getMeta(db, META_KEYS.currency)).toBe("JPY");
    });

    it("reports the tables it wrote so the caller can invalidate them", async () => {
        const result = await applyPulledRows(db, {
            cursor: 2,
            rows: [
                txRow("t1", 1, 5000),
                {
                    deletedAt: null,
                    deviceId: "device-b",
                    fields: { value: "JPY" },
                    localId: META_KEYS.currency,
                    seq: 2,
                    table: "appMeta",
                    updatedAt: 5000,
                },
            ],
        });

        expect(result.tables.sort((a, b) => a.localeCompare(b))).toStrictEqual(["appMeta", "transactions"]);
    });
});

function budgetRow(localId: string, seq: number, updatedAt: number, categoryId: string | null): PulledRow {
    return {
        deletedAt: null,
        deviceId: "device-b",
        fields: {
            amount: 100,
            amountUsd: 100,
            categoryId,
            currency: "USD",
            dateCreated: null,
            green: false,
            name: null,
            rollover: false,
            startDate: null,
            type: 0,
        },
        localId,
        seq,
        table: "budgets",
        updatedAt,
    };
}

describe("r3 — invariants Convex cannot hold", () => {
    let db: Database;
    beforeEach(() => {
        db = makeDb();
    });

    it("keeps one live budget per category when the incoming row wins", async () => {
        await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
        await db.insert(budgets).values({
            amount: 50,
            categoryId: "c1",
            id: "local",
            type: 0,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [budgetRow("remote", 1, 9000, "c1")],
        });

        const rows = await db.select().from(budgets);
        const live = rows.filter((row) => row.deletedAt === null);
        expect(live).toHaveLength(1);
        expect(live[0].id).toBe("remote");
        const loser = rows.find((row) => row.id === "local");
        expect(loser?.deletedAt).not.toBeNull();
        expect(loser?.categoryId).toBeNull();
    });

    it("tombstones the incoming budget when the local one wins", async () => {
        await setSyncEnabled(db, true);
        await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
        await db.insert(budgets).values({
            amount: 50,
            categoryId: "c1",
            id: "local",
            type: 0,
            updatedAt: AT(9000),
        });
        await db.delete(outbox);

        await applyPulledRows(db, {
            cursor: 1,
            rows: [budgetRow("remote", 1, 1000, "c1")],
        });

        const rows = await db.select().from(budgets);
        const live = rows.filter((row) => row.deletedAt === null);
        expect(live).toHaveLength(1);
        expect(live[0].id).toBe("local");
        expect(rows.find((row) => row.id === "remote")?.categoryId).toBeNull();
        // The row this device wrote is NOT what the server holds, so it must stay
        // queued rather than be cleared as an applied row.
        expect((await db.select().from(outbox)).map((row) => row.localId)).toStrictEqual(["remote"]);
    });

    it("queues the tombstone it writes so the other device converges", async () => {
        await setSyncEnabled(db, true);
        await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
        await db.insert(budgets).values({
            amount: 50,
            categoryId: "c1",
            id: "local",
            type: 0,
            updatedAt: AT(1000),
        });
        await db.delete(outbox);

        await applyPulledRows(db, {
            cursor: 1,
            rows: [budgetRow("remote", 1, 9000, "c1")],
        });

        const queued = await db.select().from(outbox);
        expect(queued.map((row) => row.localId)).toStrictEqual(["local"]);
    });

    it("picks the same survivor on both devices when updatedAt ties", async () => {
        const seed = async (database: Database, mine: string, theirs: string) => {
            await database.insert(categories).values({ id: "c1", updatedAt: AT(1) });
            await database.insert(budgets).values({
                amount: 50,
                categoryId: "c1",
                id: mine,
                type: 0,
                updatedAt: AT(5000),
            });
            await applyPulledRows(database, {
                cursor: 1,
                rows: [budgetRow(theirs, 1, 5000, "c1")],
            });
            const rows = await database.select().from(budgets);
            return rows.filter((row) => row.deletedAt === null).map((row) => row.id);
        };

        const first = makeDb();
        const second = makeDb();

        expect(await seed(first, "aaa", "zzz")).toStrictEqual(["zzz"]);
        expect(await seed(second, "zzz", "aaa")).toStrictEqual(["zzz"]);
    });

    it("leaves two budgets on different categories alone", async () => {
        await db.insert(categories).values([
            { id: "c1", updatedAt: AT(1) },
            { id: "c2", updatedAt: AT(1) },
        ]);
        await db.insert(budgets).values({
            amount: 50,
            categoryId: "c1",
            id: "local",
            type: 0,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [budgetRow("remote", 1, 9000, "c2")],
        });

        const live = (await db.select().from(budgets)).filter((row) => row.deletedAt === null);
        expect(live).toHaveLength(2);
    });

    it("collapses two live overall budgets to one", async () => {
        await db.insert(mainBudget).values({
            amount: 50,
            id: "local",
            type: 0,
            updatedAt: AT(1000),
        });

        await applyPulledRows(db, {
            cursor: 1,
            rows: [
                {
                    deletedAt: null,
                    deviceId: "device-b",
                    fields: {
                        amount: 100,
                        amountUsd: 100,
                        currency: "USD",
                        dateCreated: null,
                        green: false,
                        name: null,
                        rollover: false,
                        startDate: null,
                        type: 0,
                    },
                    localId: "remote",
                    seq: 1,
                    table: "mainBudget",
                    updatedAt: 9000,
                },
            ],
        });

        const live = (await db.select().from(mainBudget)).filter((row) => row.deletedAt === null);
        expect(live).toHaveLength(1);
        expect(live[0].id).toBe("remote");
    });
});

describe("two devices against one account", () => {
    it("applies a re-emitted pending-custom winner after its original sequence was consumed", async () => {
        const db = makeDb();
        await setSyncEnabled(db, true);
        await applyPulledRows(db, { cursor: 1, rows: [metaRow("currency", 1, 50, "VES")] });
        await addTransaction(db, "t1", {
            amountUsd: 2.5,
            currency: "VES",
            exchangeRate: 40,
            exchangeRateType: "official",
            updatedAt: AT(100),
        });
        let correctionEmitted = false;
        const push: PushFn = async ({ rows }) => {
            correctionEmitted = true;
            return { accepted: 0, nextSeq: 3, skipped: rows.length };
        };
        const pull = async ({ cursor }: { cursor: number; limit: number }) => ({
            cursor: correctionEmitted ? 2 : cursor,
            hasMore: false,
            rows: correctionEmitted
                ? [
                      txRow("t1", 2, 100, {
                          deviceId: "device-a",
                          fields: { currency: "VES", exchangeRateType: "custom" },
                      }),
                  ]
                : [],
        });

        await runSync(db, { pull, push });

        const [row] = await db.select().from(transactions);
        expect(row).toMatchObject({ amountUsd: null, exchangeRate: null, exchangeRateType: "custom" });
        expect(await getSyncCursor(db)).toBe(2);
        expect(await outboxPendingCount(db)).toBe(0);
    });

    it("replicates a ledger from one device to the other", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await addTransaction(alpha, "t1", { note: "coffee" });
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);

        const [row] = await beta.select().from(transactions);
        expect(row.note).toBe("coffee");
        expect(await outboxPendingCount(beta)).toBe(0);
    });

    it("replicates an account, dates as epochs and the local path withheld", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await alpha.insert(accounts).values({
            currency: "EUR",
            dateCreated: AT(3000),
            id: "acct-1",
            imageUri: "file:///alpha/container/photo.jpg",
            initialBalance: 250,
            initialBalanceDate: AT(4000),
            initialBalanceUsd: 270,
            name: "Checking",
            sortOrder: 2,
            updatedAt: AT(3000),
        });
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);

        const [row] = await beta.select().from(accounts);
        expect(row.name).toBe("Checking");
        expect(row.currency).toBe("EUR");
        expect(row.initialBalance).toBe(250);
        expect(row.initialBalanceUsd).toBe(270);
        expect(row.initialBalanceDate.getTime()).toBe(4000);
        expect(row.dateCreated.getTime()).toBe(3000);
        expect(row.sortOrder).toBe(2);
        expect(row.imageUri).toBeNull();
        expect(await outboxPendingCount(beta)).toBe(0);
    });

    it("converges a concurrent edit to the same row on the later writer", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await addTransaction(alpha, "t1", { note: "seed", updatedAt: AT(1000) });
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);

        await bumpNote(alpha, "t1", "from-alpha", 2000);
        await bumpNote(beta, "t1", "from-beta", 3000);
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);
        await runSync(alpha, server.transport);

        expect((await alpha.select().from(transactions))[0].note).toBe("from-beta");
        expect((await beta.select().from(transactions))[0].note).toBe("from-beta");
    });

    it("keeps a row deleted when a tombstone races an edit", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await addTransaction(alpha, "t1", { updatedAt: AT(1000) });
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);

        // Alpha deletes; beta edits the same row LATER and still loses, because
        // R1 does not consult the clock.
        await tombstone(alpha, "t1", 2000);
        await bumpNote(beta, "t1", "still-here", 9000);
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);
        await runSync(alpha, server.transport);
        await runSync(beta, server.transport);

        for (const db of [alpha, beta]) {
            const [row] = await db.select().from(transactions);
            expect(row.deletedAt).not.toBeNull();
        }
    });

    it("applies a pull without losing an unpushed local edit to another row", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await addTransaction(alpha, "remote-row", { note: "from-alpha" });
        await runSync(alpha, server.transport);

        // Beta has its own unsent row when the page lands.
        await addTransaction(beta, "local-row", { note: "unsent" });
        const applied = await pullAndApply(beta, server.pull);

        expect(applied.applied).toBe(1);
        expect(await outboxPendingCount(beta)).toBe(1);
        const notes = (await beta.select().from(transactions)).map((row) => row.note).sort();
        expect(notes).toStrictEqual(["from-alpha", "unsent"]);
    });

    it("settles after a full round trip with nothing left queued", async () => {
        const alpha = makeDb();
        const beta = makeDb();
        const server = makeServer();
        await setSyncEnabled(alpha, true);
        await setSyncEnabled(beta, true);

        await addTransaction(alpha, "t1");
        await addTransaction(beta, "t2");
        for (let round = 0; round < 3; round += 1) {
            await runSync(alpha, server.transport);
            await runSync(beta, server.transport);
        }

        expect(await outboxPendingCount(alpha)).toBe(0);
        expect(await outboxPendingCount(beta)).toBe(0);
        expect(await alpha.select().from(transactions)).toHaveLength(2);
        expect(await beta.select().from(transactions)).toHaveLength(2);
        expect(await getSyncCursor(alpha)).toBe(await getSyncCursor(beta));
    });

    it("stops rather than looping when a page does not advance the cursor", async () => {
        const db = makeDb();
        await setSyncEnabled(db, true);
        let calls = 0;

        await pullAndApply(db, async () => {
            calls += 1;
            return { cursor: 0, hasMore: true, rows: [txRow("t1", 1, 5000)] };
        });

        expect(calls).toBe(1);
    });

    it("does not pull while the gate is shut", async () => {
        const db = makeDb();
        let calls = 0;

        await pullAndApply(db, async () => {
            calls += 1;
            return { cursor: 0, hasMore: false, rows: [] };
        });

        expect(calls).toBe(0);
    });
});

async function bumpNote(db: Database, id: string, note: string, at: number): Promise<void> {
    await db
        .update(transactions)
        .set({ note, updatedAt: AT(at) })
        .where(eqId(id));
}

async function tombstone(db: Database, id: string, at: number): Promise<void> {
    await db
        .update(transactions)
        .set({ deletedAt: AT(at), updatedAt: AT(at) })
        .where(eqId(id));
}
