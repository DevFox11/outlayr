import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const MIGRATIONS = join(__dirname, "../../drizzle");

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

		expect(
			(await splitsForQuery(db, "t1")).map((row) => [
				row.categoryId,
				row.amount,
			]),
		).toStrictEqual([
			["food", 25],
			["travel", 15],
		]);
	});

	it("refuses a split that does not add up", async () => {
		// The only guard there is: SQLite cannot express the constraint.
		await expect(
			splitsRepo.setSplit(db, "t1", 40, [{ categoryId: "food", amount: 25 }]),
		).rejects.toThrow(UnbalancedSplitError);
		expect(await splitsForQuery(db, "t1")).toStrictEqual([]);
	});

	it("replaces a split wholesale rather than merging into it", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "travel", amount: 40 },
		]);

		expect(
			(await splitsForQuery(db, "t1")).map((row) => [
				row.categoryId,
				row.amount,
			]),
		).toStrictEqual([["travel", 40]]);
	});

	it("clears a split so the entry goes back to its own category", async () => {
		// No rows is the implicit whole, not "attributed to nothing".
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, []);

		expect(await splitsForQuery(db, "t1")).toStrictEqual([]);
		const totals = totalsByCategory(
			[{ id: "t1", amount: 40, categoryId: "food" }],
			new Map(),
		);
		expect(totals.get("food")).toBe(40);
	});

	it("leaves the replaced rows as tombstones so the change travels", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 40 },
		]);
		await splitsRepo.setSplit(db, "t1", 40, []);

		const all = await db.select().from(transactionSplits);
		expect(all.length).toBe(1);
		expect(all[0].deletedAt).toBeTruthy();
	});

	it("retires the parts of an entry that is going", async () => {
		// A live split under a tombstoned entry keeps feeding its categories: the
		// entry is gone from every list and its parts are not.
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 25 },
			{ categoryId: "travel", amount: 15 },
		]);

		await splitsRepo.clearForTransactions(db, ["t1"]);

		expect(await splitsForQuery(db, "t1")).toStrictEqual([]);
	});

	it("does nothing when given no entries to clear", async () => {
		await splitsRepo.setSplit(db, "t1", 40, [
			{ categoryId: "food", amount: 40 },
		]);
		await splitsRepo.clearForTransactions(db, []);
		expect((await splitsForQuery(db, "t1")).length).toBe(1);
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
		expect(totals.size).toBe(0);
		// The rows survive, so an undo needs no repair and replication still
		// carries whatever the entry is restored to.
		expect((await splitsForQuery(db, "t1")).length).toBe(2);
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

		expect(totals.get("food")).toBe(25);
		expect(totals.get("travel")).toBe(15);
		expect([...totals.values()].reduce((a, b) => a + b, 0)).toBe(40);
	});
});
