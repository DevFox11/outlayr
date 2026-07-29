import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import {
	budgets,
	categories,
	mainBudget,
	outbox,
	transactions,
} from "@/db/schema";
import { getMeta, META_KEYS, setMeta } from "./app-meta-core";
import {
	applyPulledRows,
	drainOutbox,
	incomingWinsLocally,
	type PulledRow,
	type PushFn,
	pullAndApply,
	runSync,
	specFor,
	type WireRow,
} from "./sync-engine-core";
import {
	getSyncCursor,
	outboxPendingCount,
	SYNCED_TABLES,
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
		existing: PulledRow | undefined,
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
			rows.set(key, { ...row, seq: nextSeq, deviceId });
			nextSeq += 1;
			accepted += 1;
		}
		return { accepted, skipped, nextSeq };
	};

	const pull = async ({ cursor, limit }: { cursor: number; limit: number }) => {
		const after = [...rows.values()]
			.filter((row) => row.seq > cursor)
			.sort((a, b) => a.seq - b.seq);
		const page = after.slice(0, limit);
		return {
			rows: page,
			cursor: page.length > 0 ? page[page.length - 1].seq : cursor,
			hasMore: after.length > page.length,
		};
	};

	return { push, pull, rows, transport: { push, pull } };
}

const AT = (ms: number) => new Date(ms);

const eqId = (id: string) => eq(transactions.id, id);

async function addTransaction(
	db: Database,
	id: string,
	overrides: Partial<typeof transactions.$inferInsert> = {},
): Promise<void> {
	await db.insert(transactions).values({
		id,
		amount: 10,
		income: false,
		note: id,
		date: AT(1000),
		day: AT(1000),
		month: AT(1000),
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
	} = {},
): PulledRow {
	return {
		table: "transactions",
		localId,
		seq,
		deviceId: overrides.deviceId ?? "device-b",
		updatedAt,
		deletedAt: overrides.deletedAt ?? null,
		fields: {
			amount: 10,
			income: false,
			currency: null,
			note: localId,
			details: null,
			date: 1000,
			day: 1000,
			month: 1000,
			icon: null,
			emoji: null,
			customColor: null,
			imageColor: null,
			imageUri: null,
			onceRecurring: false,
			recurringType: 0,
			recurringCoefficient: 1,
			recurringEndDate: null,
			categoryId: null,
			amountUsd: null,
			exchangeRate: null,
			exchangeRateType: null,
			...overrides.fields,
		},
	};
}

function metaRow(
	key: string,
	seq: number,
	updatedAt: number,
	value: string | null,
): PulledRow {
	return {
		table: "appMeta",
		localId: key,
		seq,
		deviceId: "device-b",
		updatedAt,
		deletedAt: null,
		fields: { value },
	};
}

describe("the replicated column set", () => {
	// A column added to the local schema and not to the spec replicates as
	// permanently absent rather than as an error, which no round-trip test would
	// notice on its own.
	const ENVELOPE = new Set(["id", "key", "updatedAt", "deletedAt"]);

	for (const table of SYNCED_TABLES) {
		it(`covers every column of ${table}`, () => {
			const spec = specFor(table);
			const declared = Object.keys(getTableColumns(spec.table)).filter(
				(name) => !ENVELOPE.has(name),
			);

			assert.deepEqual([...spec.fields].sort(), declared.sort());
		});
	}

	it("names only real timestamp columns as dates", () => {
		for (const table of SYNCED_TABLES) {
			const spec = specFor(table);
			for (const name of spec.dates) {
				assert.ok(
					spec.fields.includes(name),
					`${table}.${name} is not a replicated column`,
				);
			}
		}
	});
});

describe("incomingWinsLocally", () => {
	it("takes anything when there is no local row", () => {
		assert.equal(
			incomingWinsLocally({ updatedAt: 1, deletedAt: null }, null, false),
			true,
		);
	});

	it("R1 — a tombstone is absorbing in both directions", () => {
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 1, deletedAt: 1 },
				{ updatedAt: 999, deletedAt: null },
				false,
			),
			true,
		);
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 999, deletedAt: null },
				{ updatedAt: 1, deletedAt: 1 },
				false,
			),
			false,
		);
	});

	it("R2 — the greater updatedAt takes the row", () => {
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 2, deletedAt: null },
				{ updatedAt: 1, deletedAt: null },
				false,
			),
			true,
		);
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 1, deletedAt: null },
				{ updatedAt: 2, deletedAt: null },
				false,
			),
			false,
		);
	});

	it("keeps an unsent local edit on an exact tie", () => {
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 5, deletedAt: null },
				{ updatedAt: 5, deletedAt: null },
				true,
			),
			false,
		);
		assert.equal(
			incomingWinsLocally(
				{ updatedAt: 5, deletedAt: null },
				{ updatedAt: 5, deletedAt: null },
				false,
			),
			true,
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
			return { accepted: 0, skipped: 0, nextSeq: 1 };
		};

		assert.equal(await drainOutbox(db, push), 0);
		assert.equal(calls, 0);
	});

	it("pushes queued rows and clears exactly what it sent", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1");
		await addTransaction(db, "t2");
		const server = makeServer();

		assert.equal(await drainOutbox(db, server.push), 2);
		assert.equal(await outboxPendingCount(db), 0);
		assert.equal(server.rows.size, 2);
	});

	it("carries the row's own values, dates as epoch milliseconds", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1", {
			amount: 42.5,
			note: "lunch",
			date: AT(5000),
			updatedAt: AT(7000),
		});
		let seen: WireRow[] = [];
		await drainOutbox(db, async ({ rows }) => {
			seen = rows;
			return { accepted: rows.length, skipped: 0, nextSeq: 1 };
		});

		assert.equal(seen[0].table, "transactions");
		assert.equal(seen[0].updatedAt, 7000);
		assert.equal(seen[0].deletedAt, null);
		assert.equal(seen[0].fields.amount, 42.5);
		assert.equal(seen[0].fields.note, "lunch");
		assert.equal(seen[0].fields.date, 5000);
		assert.equal(seen[0].fields.categoryId, null);
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
			return { accepted: rows.length, skipped: 0, nextSeq: 1 };
		});

		assert.equal(seen[0].deletedAt, 9000);
	});

	it("leaves an edit that arrived mid-flight queued", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1");
		const push: PushFn = async ({ rows }) => {
			await db
				.update(transactions)
				.set({ note: "edited", updatedAt: AT(2000) })
				.where(eqId("t1"));
			return { accepted: rows.length, skipped: 0, nextSeq: 1 };
		};

		await drainOutbox(db, push);

		assert.equal(await outboxPendingCount(db), 1);
	});

	it("pages a queue longer than one batch", async () => {
		await setSyncEnabled(db, true);
		for (let i = 0; i < 501; i += 1) {
			await addTransaction(db, `t${i}`);
		}
		const batches: number[] = [];
		await drainOutbox(db, async ({ rows }) => {
			batches.push(rows.length);
			return { accepted: rows.length, skipped: 0, nextSeq: 1 };
		});

		assert.deepEqual(batches, [500, 1]);
		assert.equal(await outboxPendingCount(db), 0);
	});

	it("keeps the queue when the push throws", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1");

		await assert.rejects(
			drainOutbox(db, async () => {
				throw new Error("offline");
			}),
		);
		assert.equal(await outboxPendingCount(db), 1);
	});

	it("pushes only the account-scoped meta keys", async () => {
		await setSyncEnabled(db, true);
		await setMeta(db, META_KEYS.currency, "EUR");
		await setMeta(db, META_KEYS.firstLaunch, "0");
		let seen: WireRow[] = [];
		await drainOutbox(db, async ({ rows }) => {
			seen = rows;
			return { accepted: rows.length, skipped: 0, nextSeq: 1 };
		});

		assert.deepEqual(
			seen.map((row) => row.localId),
			[META_KEYS.currency],
		);
		assert.equal(seen[0].fields.value, "EUR");
		assert.equal(seen[0].deletedAt, null);
	});
});

describe("applyPulledRows", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("inserts a row this device has never seen", async () => {
		const result = await applyPulledRows(db, {
			rows: [txRow("remote", 1, 5000, { fields: { amount: 7.5 } })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(result.applied, 1);
		assert.equal(row.id, "remote");
		assert.equal(row.amount, 7.5);
		assert.equal(row.updatedAt.getTime(), 5000);
		assert.equal(await getSyncCursor(db), 1);
	});

	it("round-trips dates and nulls", async () => {
		await applyPulledRows(db, {
			rows: [
				txRow("remote", 1, 5000, {
					fields: { date: 111, day: 222, month: 333, recurringEndDate: null },
				}),
			],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(row.date.getTime(), 111);
		assert.equal(row.day.getTime(), 222);
		assert.equal(row.month.getTime(), 333);
		assert.equal(row.recurringEndDate, null);
		assert.equal(row.deletedAt, null);
	});

	it("overwrites a local row the incoming one outranks", async () => {
		await addTransaction(db, "t1", { note: "mine", updatedAt: AT(1000) });

		await applyPulledRows(db, {
			rows: [txRow("t1", 1, 9000, { fields: { note: "theirs" } })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(row.note, "theirs");
	});

	it("keeps a newer local row and does not clear its queue entry", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1", { note: "mine", updatedAt: AT(9000) });

		const result = await applyPulledRows(db, {
			rows: [txRow("t1", 1, 1000, { fields: { note: "theirs" } })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(result.applied, 0);
		assert.equal(row.note, "mine");
		assert.equal(await outboxPendingCount(db), 1);
	});

	it("R1 — an incoming tombstone beats a newer local edit", async () => {
		await addTransaction(db, "t1", { updatedAt: AT(9000) });

		await applyPulledRows(db, {
			rows: [txRow("t1", 1, 1000, { deletedAt: 1000 })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(row.deletedAt?.getTime(), 1000);
	});

	it("R1 — a local tombstone is not resurrected by a newer incoming edit", async () => {
		await addTransaction(db, "t1", {
			updatedAt: AT(1000),
			deletedAt: AT(1000),
		});

		await applyPulledRows(db, {
			rows: [txRow("t1", 1, 9000, { fields: { note: "back" } })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(row.deletedAt?.getTime(), 1000);
		assert.notEqual(row.note, "back");
	});

	it("keeps an unsent local edit on an exact updatedAt tie", async () => {
		await setSyncEnabled(db, true);
		await addTransaction(db, "t1", { note: "mine", updatedAt: AT(5000) });

		await applyPulledRows(db, {
			rows: [txRow("t1", 1, 5000, { fields: { note: "theirs" } })],
			cursor: 1,
		});

		const [row] = await db.select().from(transactions);
		assert.equal(row.note, "mine");
		assert.equal(await outboxPendingCount(db), 1);
	});

	it("deletes the queue entries its own writes create", async () => {
		await setSyncEnabled(db, true);

		await applyPulledRows(db, {
			rows: [txRow("remote", 1, 5000)],
			cursor: 1,
		});

		assert.equal(
			await outboxPendingCount(db),
			0,
			"a pulled row queued for push is a pull-push echo loop",
		);
	});

	it("applies a page whose transaction precedes the category it references", async () => {
		const category: PulledRow = {
			table: "categories",
			localId: "c1",
			seq: 2,
			deviceId: "device-b",
			updatedAt: 6000,
			deletedAt: null,
			fields: {
				name: "Bills",
				color: "#FFFFFF",
				icon: null,
				emoji: null,
				income: false,
				sortOrder: 0,
				dateCreated: null,
				parentId: null,
			},
		};

		const result = await applyPulledRows(db, {
			rows: [txRow("t1", 1, 5000, { fields: { categoryId: "c1" } }), category],
			cursor: 2,
		});

		assert.equal(result.applied, 2);
		const [row] = await db.select().from(transactions);
		assert.equal(row.categoryId, "c1");
	});

	it("advances the cursor only as far as the page reached", async () => {
		await applyPulledRows(db, { rows: [txRow("t1", 1, 5000)], cursor: 1 });
		await applyPulledRows(db, { rows: [txRow("t2", 7, 5000)], cursor: 7 });

		assert.equal(await getSyncCursor(db), 7);
	});

	it("leaves the cursor alone on an empty page", async () => {
		await applyPulledRows(db, { rows: [], cursor: 99 });

		assert.equal(await getSyncCursor(db), 0);
	});

	it("writes an appMeta key by its key", async () => {
		await applyPulledRows(db, {
			rows: [
				{
					table: "appMeta",
					localId: META_KEYS.currency,
					seq: 1,
					deviceId: "device-b",
					updatedAt: 5000,
					deletedAt: null,
					fields: { value: "JPY" },
				},
			],
			cursor: 1,
		});

		assert.equal(await getMeta(db, META_KEYS.currency), "JPY");
	});

	// `appMeta` carries no `updatedAt` column, so without the pending guard every
	// incoming value would outrank a local one the device has not sent yet.
	it("keeps an unsent local meta value rather than taking the incoming one", async () => {
		await setSyncEnabled(db, true);
		await setMeta(db, META_KEYS.currency, "GBP");

		await applyPulledRows(db, {
			rows: [metaRow(META_KEYS.currency, 1, 9000, "JPY")],
			cursor: 1,
		});

		assert.equal(await getMeta(db, META_KEYS.currency), "GBP");
		assert.equal(await outboxPendingCount(db), 1);
	});

	it("takes the incoming meta value when nothing local is owed", async () => {
		await setMeta(db, META_KEYS.currency, "GBP");

		await applyPulledRows(db, {
			rows: [metaRow(META_KEYS.currency, 1, 9000, "JPY")],
			cursor: 1,
		});

		assert.equal(await getMeta(db, META_KEYS.currency), "JPY");
	});

	it("reports the tables it wrote so the caller can invalidate them", async () => {
		const result = await applyPulledRows(db, {
			rows: [
				txRow("t1", 1, 5000),
				{
					table: "appMeta",
					localId: META_KEYS.currency,
					seq: 2,
					deviceId: "device-b",
					updatedAt: 5000,
					deletedAt: null,
					fields: { value: "JPY" },
				},
			],
			cursor: 2,
		});

		assert.deepEqual(result.tables.sort(), ["appMeta", "transactions"]);
	});
});

function budgetRow(
	localId: string,
	seq: number,
	updatedAt: number,
	categoryId: string | null,
): PulledRow {
	return {
		table: "budgets",
		localId,
		seq,
		deviceId: "device-b",
		updatedAt,
		deletedAt: null,
		fields: {
			name: null,
			amount: 100,
			type: 0,
			startDate: null,
			dateCreated: null,
			currency: "USD",
			amountUsd: 100,
			green: false,
			categoryId,
		},
	};
}

describe("R3 — invariants Convex cannot hold", () => {
	let db: Database;
	beforeEach(() => {
		db = makeDb();
	});

	it("keeps one live budget per category when the incoming row wins", async () => {
		await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
		await db.insert(budgets).values({
			id: "local",
			amount: 50,
			type: 0,
			categoryId: "c1",
			updatedAt: AT(1000),
		});

		await applyPulledRows(db, {
			rows: [budgetRow("remote", 1, 9000, "c1")],
			cursor: 1,
		});

		const rows = await db.select().from(budgets);
		const live = rows.filter((row) => row.deletedAt === null);
		assert.equal(live.length, 1);
		assert.equal(live[0].id, "remote");
		const loser = rows.find((row) => row.id === "local");
		assert.notEqual(loser?.deletedAt, null);
		assert.equal(loser?.categoryId, null);
	});

	it("tombstones the incoming budget when the local one wins", async () => {
		await setSyncEnabled(db, true);
		await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
		await db.insert(budgets).values({
			id: "local",
			amount: 50,
			type: 0,
			categoryId: "c1",
			updatedAt: AT(9000),
		});
		await db.delete(outbox);

		await applyPulledRows(db, {
			rows: [budgetRow("remote", 1, 1000, "c1")],
			cursor: 1,
		});

		const rows = await db.select().from(budgets);
		const live = rows.filter((row) => row.deletedAt === null);
		assert.equal(live.length, 1);
		assert.equal(live[0].id, "local");
		assert.equal(rows.find((row) => row.id === "remote")?.categoryId, null);
		// The row this device wrote is NOT what the server holds, so it must stay
		// queued rather than be cleared as an applied row.
		assert.deepEqual(
			(await db.select().from(outbox)).map((row) => row.localId),
			["remote"],
		);
	});

	it("queues the tombstone it writes so the other device converges", async () => {
		await setSyncEnabled(db, true);
		await db.insert(categories).values({ id: "c1", updatedAt: AT(1) });
		await db.insert(budgets).values({
			id: "local",
			amount: 50,
			type: 0,
			categoryId: "c1",
			updatedAt: AT(1000),
		});
		await db.delete(outbox);

		await applyPulledRows(db, {
			rows: [budgetRow("remote", 1, 9000, "c1")],
			cursor: 1,
		});

		const queued = await db.select().from(outbox);
		assert.deepEqual(
			queued.map((row) => row.localId),
			["local"],
		);
	});

	it("picks the same survivor on both devices when updatedAt ties", async () => {
		const seed = async (database: Database, mine: string, theirs: string) => {
			await database.insert(categories).values({ id: "c1", updatedAt: AT(1) });
			await database.insert(budgets).values({
				id: mine,
				amount: 50,
				type: 0,
				categoryId: "c1",
				updatedAt: AT(5000),
			});
			await applyPulledRows(database, {
				rows: [budgetRow(theirs, 1, 5000, "c1")],
				cursor: 1,
			});
			const rows = await database.select().from(budgets);
			return rows.filter((row) => row.deletedAt === null).map((row) => row.id);
		};

		const first = makeDb();
		const second = makeDb();

		assert.deepEqual(await seed(first, "aaa", "zzz"), ["zzz"]);
		assert.deepEqual(await seed(second, "zzz", "aaa"), ["zzz"]);
	});

	it("leaves two budgets on different categories alone", async () => {
		await db.insert(categories).values([
			{ id: "c1", updatedAt: AT(1) },
			{ id: "c2", updatedAt: AT(1) },
		]);
		await db.insert(budgets).values({
			id: "local",
			amount: 50,
			type: 0,
			categoryId: "c1",
			updatedAt: AT(1000),
		});

		await applyPulledRows(db, {
			rows: [budgetRow("remote", 1, 9000, "c2")],
			cursor: 1,
		});

		const live = (await db.select().from(budgets)).filter(
			(row) => row.deletedAt === null,
		);
		assert.equal(live.length, 2);
	});

	it("collapses two live overall budgets to one", async () => {
		await db.insert(mainBudget).values({
			id: "local",
			amount: 50,
			type: 0,
			updatedAt: AT(1000),
		});

		await applyPulledRows(db, {
			rows: [
				{
					table: "mainBudget",
					localId: "remote",
					seq: 1,
					deviceId: "device-b",
					updatedAt: 9000,
					deletedAt: null,
					fields: {
						name: null,
						amount: 100,
						type: 0,
						startDate: null,
						dateCreated: null,
						currency: "USD",
						amountUsd: 100,
						green: false,
					},
				},
			],
			cursor: 1,
		});

		const live = (await db.select().from(mainBudget)).filter(
			(row) => row.deletedAt === null,
		);
		assert.equal(live.length, 1);
		assert.equal(live[0].id, "remote");
	});
});

describe("two devices against one account", () => {
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
		assert.equal(row.note, "coffee");
		assert.equal(await outboxPendingCount(beta), 0);
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

		assert.equal(
			(await alpha.select().from(transactions))[0].note,
			"from-beta",
		);
		assert.equal((await beta.select().from(transactions))[0].note, "from-beta");
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
			assert.notEqual(row.deletedAt, null);
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

		assert.equal(applied.applied, 1);
		assert.equal(await outboxPendingCount(beta), 1);
		const notes = (await beta.select().from(transactions))
			.map((row) => row.note)
			.sort();
		assert.deepEqual(notes, ["from-alpha", "unsent"]);
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

		assert.equal(await outboxPendingCount(alpha), 0);
		assert.equal(await outboxPendingCount(beta), 0);
		assert.equal((await alpha.select().from(transactions)).length, 2);
		assert.equal((await beta.select().from(transactions)).length, 2);
		assert.equal(await getSyncCursor(alpha), await getSyncCursor(beta));
	});

	it("stops rather than looping when a page does not advance the cursor", async () => {
		const db = makeDb();
		await setSyncEnabled(db, true);
		let calls = 0;

		await pullAndApply(db, async () => {
			calls += 1;
			return { rows: [txRow("t1", 1, 5000)], cursor: 0, hasMore: true };
		});

		assert.equal(calls, 1);
	});

	it("does not pull while the gate is shut", async () => {
		const db = makeDb();
		let calls = 0;

		await pullAndApply(db, async () => {
			calls += 1;
			return { rows: [], cursor: 0, hasMore: false };
		});

		assert.equal(calls, 0);
	});
});

async function bumpNote(
	db: Database,
	id: string,
	note: string,
	at: number,
): Promise<void> {
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
