import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
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
		const sql = readFileSync(join(MIGRATIONS, file), "utf8");
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
		id,
		amount: 1,
		income: false,
		date: new Date(1),
		day: new Date(1),
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

		assert.match(first, /^[0-9a-f-]{36}$/);
		assert.equal(await getOrCreateDeviceId(db), first);
		assert.equal(await getMeta(db, META_KEYS.syncDeviceId), first);
	});

	it("never queues the device id for replication", async () => {
		await setSyncEnabled(db, true);
		await getOrCreateDeviceId(db);

		assert.equal(await outboxPendingCount(db), 0);
	});
});

describe("sync cursor", () => {
	let db: Database;

	beforeEach(() => {
		db = makeDb();
	});

	it("starts at zero", async () => {
		assert.equal(await getSyncCursor(db), 0);
	});

	it("round-trips", async () => {
		await setSyncCursor(db, 4218);

		assert.equal(await getSyncCursor(db), 4218);
	});

	it("falls back to zero rather than replaying from a corrupt cursor", async () => {
		await setMeta(db, META_KEYS.syncCursor, "not-a-number");

		assert.equal(await getSyncCursor(db), 0);
	});

	it("never queues the cursor for replication", async () => {
		await setSyncEnabled(db, true);
		await setSyncCursor(db, 7);

		assert.equal(await outboxPendingCount(db), 0);
	});
});

describe("the sync gate", () => {
	let db: Database;

	beforeEach(() => {
		db = makeDb();
	});

	it("is off until something turns it on", async () => {
		assert.equal(await isSyncEnabled(db), false);

		await addTransaction(db, "t1");

		assert.equal(await outboxPendingCount(db), 0);
	});

	it("queues writes once it is on", async () => {
		await setSyncEnabled(db, true);

		assert.equal(await isSyncEnabled(db), true);

		await addTransaction(db, "t1");

		assert.equal(await outboxPendingCount(db), 1);
	});

	it("empties the queue when it is turned back off", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1");

		await setSyncEnabled(db, false);

		assert.equal(await outboxPendingCount(db), 0);

		await addTransaction(db, "t2");

		assert.equal(await outboxPendingCount(db), 0);
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
			id: "gone",
			amount: 0,
			income: false,
			date: new Date(1),
			day: new Date(1),
			month: new Date(1),
			updatedAt: new Date(1),
			deletedAt: new Date(2),
		});
		await db.insert(categories).values({ id: "c1", updatedAt: new Date(1) });

		await setSyncEnabled(db, true);
		await enqueueAllForSync(db);

		assert.equal(await outboxPendingCount(db), 3);
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

		assert.equal(await outboxPendingCount(db), SYNCED_META_KEYS.length);
	});

	it("is idempotent", async () => {
		await addTransaction(db, "t1");

		await enqueueAllForSync(db);
		await enqueueAllForSync(db);

		assert.equal(await outboxPendingCount(db), 1);
	});

	it("queues a ledger larger than one insert can bind", async () => {
		for (let i = 0; i < 420; i += 1) {
			await addTransaction(db, `t${i}`);
		}

		await enqueueAllForSync(db);

		assert.equal(await outboxPendingCount(db), 420);
	});
});
