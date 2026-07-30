import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, transactionSplits, transactions } from "@/db/schema";
import { totalsByCategory } from "@/domain/split";
import {
	allSplitsQuery,
	splitsForQuery,
	splitsRepo,
	UnbalancedSplitError,
} from "./splits-core";
import { transactionsRepo } from "./transactions-core";

const MIGRATIONS = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../drizzle",
);

function migratedDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
			"--> statement-breakpoint",
		)) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

async function seed(db: Database) {
	for (const [id, name] of [
		["food", "Food"],
		["travel", "Travel"],
	]) {
		await db.insert(categories).values({
			id,
			name,
			income: false,
			sortOrder: 0,
			updatedAt: new Date(1),
		});
	}
	await db.insert(transactions).values({
		id: "t1",
		amount: 40,
		income: false,
		note: "",
		date: new Date(1),
		day: new Date(1),
		month: new Date(1),
		categoryId: "food",
		updatedAt: new Date(1),
	});
}

describe("splitsRepo", () => {
	let db: Database;

	beforeEach(async () => {
		db = migratedDb();
		await seed(db);
	});

	it("writes the parts in the order they were given", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);

		assert.deepEqual(
			(await splitsForQuery(db, "t1")).map((row) => [
				row.categoryId,
				row.amount,
			]),
			[
				["food", 25],
				["travel", 15],
			],
		);
	});

	it("refuses a split that does not add up", async () => {
		// The only guard there is: SQLite cannot express the constraint.
		await assert.rejects(
			splitsRepo.setSplit(db, "t1", 40, [{ categoryId: "food", amount: 25 }]),
			UnbalancedSplitError,
		);
		assert.deepEqual(await splitsForQuery(db, "t1"), []);
	});

	it("replaces a split wholesale rather than merging into it", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "travel", amount: 40 },
		]);

		assert.deepEqual(
			(await splitsForQuery(db, "t1")).map((row) => [
				row.categoryId,
				row.amount,
			]),
			[["travel", 40]],
		);
	});

	it("clears a split so the entry goes back to its own category", async () => {
		// No rows is the implicit whole, not "attributed to nothing".
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, []);

		assert.deepEqual(await splitsForQuery(db, "t1"), []);
		const totals = totalsByCategory(
			[{ id: "t1", amount: 40, categoryId: "food" }],
			new Map(),
		);
		assert.equal(totals.get("food"), 40);
	});

	it("leaves the replaced rows as tombstones so the change travels", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 40 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, []);

		const all = await db.select().from(transactionSplits);
		assert.equal(all.length, 1);
		assert.ok(all[0].deletedAt);
	});

	it("retires the parts of an entry that is going", async () => {
		// A live split under a tombstoned entry keeps feeding its categories: the
		// entry is gone from every list and its parts are not.
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);

		await splitsRepo.clearForTransactions(db, ["t1"]);

		assert.deepEqual(await splitsForQuery(db, "t1"), []);
	});

	it("does nothing when given no entries to clear", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 40 },
		]);
		await splitsRepo.clearForTransactions(db, []);
		assert.equal((await splitsForQuery(db, "t1")).length, 1);
	});

	it("is not consulted for an entry that is gone", async () => {
		// A tombstoned entry never reaches `totalsByCategory`, so its parts cannot
		// feed a category even though the rows are still live. That is why delete
		// does not touch them — and why undo cannot lose them.
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);
		await transactionsRepo.remove(db, "t1");

		const totals = totalsByCategory([], new Map());
		assert.equal(totals.size, 0);
		// The rows survive, so an undo needs no repair and replication still
		// carries whatever the entry is restored to.
		assert.equal((await splitsForQuery(db, "t1")).length, 2);
	});

	it("feeds the category totals without double-counting the entry", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);

		const byEntry = new Map<
			string,
			{ categoryId: string | null; amount: number }[]
		>();
		for (const row of await allSplitsQuery(db)) {
			const existing = byEntry.get(row.transactionId) ?? [];
			existing.push({ categoryId: row.categoryId, amount: row.amount });
			byEntry.set(row.transactionId, existing);
		}
		const totals = totalsByCategory(
			[{ id: "t1", amount: 40, categoryId: "food" }],
			byEntry,
		);

		assert.equal(totals.get("food"), 25);
		assert.equal(totals.get("travel"), 15);
		assert.equal(
			[...totals.values()].reduce((a, b) => a + b, 0),
			40,
		);
	});
});
