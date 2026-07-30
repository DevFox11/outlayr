import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { parseArchive, serializeArchive } from "@/domain/archive";
import { buildArchive, restoreArchive } from "./archive-core";

const MIGRATIONS = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../drizzle",
);

/**
 * The real migrations rather than a hand-written schema: an archive claims to
 * carry every column, so a fixture that drifts from the shipped tables would let
 * a dropped column pass.
 */
function migratedDb(): Database {
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
	return drizzle(sqlite) as unknown as Database;
}

const CATEGORY = {
	id: "c1",
	name: "Food",
	income: false,
	sortOrder: 0,
	updatedAt: new Date(1_700_000_000_000),
};

function transactionRow(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		amount: 12.5,
		income: false,
		currency: "USD",
		note: "coffee",
		date: new Date(1_700_000_000_000),
		day: new Date(1_700_000_000_000),
		month: new Date(1_700_000_000_000),
		categoryId: "c1",
		updatedAt: new Date(1_700_000_000_000),
		...overrides,
	};
}

describe("archiving a ledger", () => {
	let db: Database;

	beforeEach(() => {
		db = migratedDb();
	});

	it("round-trips a ledger through serialize, parse and restore", async () => {
		await db.insert(categories).values(CATEGORY);
		await db.insert(transactions).values(transactionRow("t1"));

		const text = serializeArchive(await buildArchive(db, new Date()));
		const parsed = parseArchive(text);
		assert.ok(parsed);

		const fresh = migratedDb();
		await restoreArchive(fresh, parsed);

		const rows = await fresh.select().from(transactions);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].note, "coffee");
		assert.equal(rows[0].amount, 12.5);
	});

	it("restores an instant as the same moment, not as text", async () => {
		// The defect this guards: JSON turns a Date into an ISO string, and a
		// column read back as a string sorts and compares differently from every
		// other date in the ledger.
		const when = new Date(1_700_000_123_456);
		await db.insert(categories).values(CATEGORY);
		await db.insert(transactions).values(transactionRow("t1", { date: when }));

		const parsed = parseArchive(serializeArchive(await buildArchive(db, when)));
		assert.ok(parsed);
		const fresh = migratedDb();
		await restoreArchive(fresh, parsed);

		const [row] = await fresh.select().from(transactions);
		assert.ok(row.date instanceof Date);
		assert.equal(row.date.getTime(), when.getTime());
	});

	it("carries a tombstone rather than dropping it", async () => {
		// A deletion the archive dropped comes back as a live row the moment a peer
		// that never saw it pushes again.
		await db.insert(categories).values(CATEGORY);
		await db
			.insert(transactions)
			.values(transactionRow("t1", { deletedAt: new Date(1_700_000_000_000) }));

		const parsed = parseArchive(
			serializeArchive(await buildArchive(db, new Date())),
		);
		assert.ok(parsed);
		const fresh = migratedDb();
		await restoreArchive(fresh, parsed);

		const [row] = await fresh.select().from(transactions);
		assert.ok(row.deletedAt instanceof Date);
	});

	it("replaces the ledger rather than merging into it", async () => {
		await db.insert(categories).values(CATEGORY);
		await db.insert(transactions).values(transactionRow("t1"));
		const parsed = parseArchive(
			serializeArchive(await buildArchive(db, new Date())),
		);
		assert.ok(parsed);

		const target = migratedDb();
		await target.insert(categories).values(CATEGORY);
		await target.insert(transactions).values(transactionRow("t2"));
		await restoreArchive(target, parsed);

		const rows = await target.select().from(transactions);
		assert.deepEqual(
			rows.map((row) => row.id),
			["t1"],
		);
	});

	it("restores a ledger larger than one insert can bind", async () => {
		await db.insert(categories).values(CATEGORY);
		for (let i = 0; i < 250; i += 1) {
			await db.insert(transactions).values(transactionRow(`t${i}`));
		}

		const parsed = parseArchive(
			serializeArchive(await buildArchive(db, new Date())),
		);
		assert.ok(parsed);
		const fresh = migratedDb();
		const written = await restoreArchive(fresh, parsed);

		assert.equal(written, 251);
		assert.equal((await fresh.select().from(transactions)).length, 250);
	});

	it("writes categories before the rows that point at them", async () => {
		// Reversing the order fails the foreign key, which better-sqlite3 enforces.
		await db.insert(categories).values(CATEGORY);
		await db.insert(transactions).values(transactionRow("t1"));
		const parsed = parseArchive(
			serializeArchive(await buildArchive(db, new Date())),
		);
		assert.ok(parsed);

		const fresh = migratedDb();
		await assert.doesNotReject(restoreArchive(fresh, parsed));
	});
});
