import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { transactions } from "@/db/schema";
import { accountLedgerState, discardAccountLedger, replaceLocalFromAccount } from "./adoption-engine-core";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import { drainOutbox, type PulledRow, type PushFn, runSync } from "./sync-engine-core";
import { enqueueAllForSync, setSyncEnabled } from "./sync-outbox-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		const sql = readFileSync(join(MIGRATIONS, file), "utf8");
		for (const statement of sql.split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	sqlite.exec("PRAGMA foreign_keys = ON");
	return drizzle(sqlite) as unknown as Database;
}

/** The same R1/R2 rule as `packages/backend/convex/lib/syncTables.ts`. */
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
			cursor: page.length > 0 ? page[page.length - 1].seq : cursor,
			hasMore: after.length > page.length,
			rows: page,
		};
	};

	return { pull, push, rows, transport: { pull, push } };
}

async function addTransaction(db: Database, id: string, updatedAt: Date): Promise<void> {
	await db.insert(transactions).values({
		amount: 10,
		date: updatedAt,
		day: updatedAt,
		id,
		income: false,
		month: updatedAt,
		note: id,
		updatedAt,
	});
}

function serverRow(localId: string, updatedAt: number, deletedAt: number | null = null): PulledRow {
	return {
		deletedAt,
		deviceId: "peer",
		fields: {
			amount: 99,
			amountUsd: null,
			categoryId: null,
			currency: null,
			customColor: null,
			date: updatedAt,
			day: updatedAt,
			details: null,
			emoji: null,
			exchangeRate: null,
			exchangeRateType: null,
			icon: null,
			imageColor: null,
			imageUri: null,
			income: false,
			month: updatedAt,
			note: `remote ${localId}`,
			onceRecurring: false,
			recurringCoefficient: 1,
			recurringEndDate: null,
			recurringType: 0,
		},
		localId,
		seq: 0,
		table: "transactions",
		updatedAt,
	};
}

describe("accountLedgerState", () => {
	it("reads an account holding only tombstones as empty", async () => {
		const server = makeServer();
		await server.push({
			deviceId: "peer",
			rows: [{ ...serverRow("a", 100, 100) }],
		});
		expect(await accountLedgerState(server.pull)).toBe("empty");
	});

	it("reads one live row as populated", async () => {
		const server = makeServer();
		await server.push({ deviceId: "peer", rows: [serverRow("a", 100)] });
		expect(await accountLedgerState(server.pull)).toBe("populated");
	});
});

describe("replaceLocalFromAccount", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("discards local rows and takes the account's", async () => {
		const server = makeServer();
		await server.push({ deviceId: "peer", rows: [serverRow("remote", 100)] });
		await addTransaction(db, "local", new Date(50));

		await replaceLocalFromAccount(db, server.pull);

		const rows = await db.select().from(transactions);
		expect(rows.map((row) => row.id)).toStrictEqual(["remote"]);
	});

	it("keeps device-local meta that no pull would hand back", async () => {
		const server = makeServer();
		await setMeta(db, META_KEYS.syncDeviceId, "this-device");
		await setMeta(db, META_KEYS.onboardingComplete, "1");
		await setMeta(db, META_KEYS.currency, "GBP");

		await replaceLocalFromAccount(db, server.pull);

		expect(await getMeta(db, META_KEYS.syncDeviceId)).toBe("this-device");
		expect(await getMeta(db, META_KEYS.onboardingComplete)).toBe("1");
		// Account-scoped, so the account's absence of it is authoritative.
		expect(await getMeta(db, META_KEYS.currency)).toBe(null);
	});
});

describe("discardAccountLedger", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	/**
	 * The whole reason this is not "tombstone everything, then push". A delete
	 * beats a live row regardless of `updatedAt`, so a shared row tombstoned here
	 * would be skipped on push and then deleted locally by the next pull — the
	 * ledger the user chose to keep, destroyed by the act of keeping it.
	 */
	it("leaves a row both sides hold alive, and lets the local one win", async () => {
		const server = makeServer();
		await server.push({ deviceId: "peer", rows: [serverRow("shared", 900)] });
		await addTransaction(db, "shared", new Date(100));

		await discardAccountLedger(db, server.transport);

		expect(server.rows.get("transactions shared")?.deletedAt).toBe(null);

		await setSyncEnabled(db, true);
		await enqueueAllForSync(db);
		await drainOutbox(db, server.push);

		const survivor = server.rows.get("transactions shared");
		expect(survivor?.deletedAt).toBe(null);
		expect(survivor?.fields.note).toBe("shared");
	});

	it("tombstones only rows this device has never seen", async () => {
		const server = makeServer();
		await server.push({
			deviceId: "peer",
			rows: [serverRow("theirs", 900), serverRow("shared", 900)],
		});
		await addTransaction(db, "shared", new Date(100));

		await discardAccountLedger(db, server.transport);

		expect(server.rows.get("transactions theirs")?.deletedAt).not.toBe(null);
		expect(server.rows.get("transactions shared")?.deletedAt).toBe(null);
	});

	it("is safe to run twice", async () => {
		const server = makeServer();
		await server.push({ deviceId: "peer", rows: [serverRow("theirs", 900)] });

		await discardAccountLedger(db, server.transport);
		const afterFirst = server.rows.get("transactions theirs")?.deletedAt;
		await discardAccountLedger(db, server.transport);

		expect(afterFirst).not.toBe(null);
		expect(server.rows.size).toBe(1);
	});
});

describe("a tombstoned account row does not come back to bite", () => {
	it("keeps the local ledger after a full keep-local round trip", async () => {
		const db = makeDb();
		const server = makeServer();
		await server.push({
			deviceId: "peer",
			rows: [serverRow("theirs", 900), serverRow("shared", 900)],
		});
		await addTransaction(db, "shared", new Date(100));
		await addTransaction(db, "mine", new Date(100));

		await discardAccountLedger(db, server.transport);
		await setSyncEnabled(db, true);
		await enqueueAllForSync(db);
		await runSync(db, server.transport);

		const live = (await db.select().from(transactions))
			.filter((row) => row.deletedAt === null)
			.map((row) => row.id)
			.sort();
		expect(live).toStrictEqual(["mine", "shared"]);
		// The account's row arrives as a tombstone rather than not at all: readers
		// filter `deletedAt`, and keeping the row is what stops a later pull from
		// resurrecting it.
		const theirs = await db.select().from(transactions).where(eq(transactions.id, "theirs"));
		expect(theirs.length).toBe(1);
		expect(theirs[0]?.deletedAt).not.toBe(null);
	});
});
