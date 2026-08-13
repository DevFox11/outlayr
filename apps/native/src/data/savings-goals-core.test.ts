import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { accounts } from "@/db/schema";
import { savingsGoalsQuery, savingsGoalsRepo } from "./savings-goals-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

function makeDb(): Database {
	const sqlite = new BetterSqlite3(":memory:");
	for (const file of readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
	return drizzle(sqlite) as unknown as Database;
}

const AUTHORED = new Date("2026-03-04T10:00:00.000Z");
let db: Database;

beforeEach(() => {
	db = makeDb();
	db.insert(accounts)
		.values({
			currency: "USD",
			dateCreated: AUTHORED,
			id: "savings",
			initialBalance: 0,
			initialBalanceDate: AUTHORED,
			name: "Savings",
			updatedAt: AUTHORED,
		})
		.run();
});

function goal(overrides: Partial<Parameters<typeof savingsGoalsRepo.create>[1]> = {}) {
	return savingsGoalsRepo.create(db, {
		accountId: "savings",
		currency: "USD",
		name: "Emergency fund",
		targetAmount: 5000,
		...overrides,
	});
}

describe("savings goals", () => {
	it("writes a goal that reads back", async () => {
		await goal();
		const [row] = await savingsGoalsQuery(db);
		expect(row).toMatchObject({ accountId: "savings", name: "Emergency fund", targetAmount: 5000 });
	});

	it("orders goals by their sort position", async () => {
		await goal({ name: "First" });
		await goal({ name: "Second" });
		const rows = await savingsGoalsQuery(db);
		expect(rows.map((row) => row.name)).toStrictEqual(["First", "Second"]);
	});

	it("keeps a deleted goal out of every read", async () => {
		const id = await goal();
		await savingsGoalsRepo.remove(db, id);
		expect(await savingsGoalsQuery(db)).toStrictEqual([]);
	});

	it("re-freezes the USD target only when the amount or currency moves", async () => {
		const id = await goal();
		const [before] = await savingsGoalsQuery(db);

		await savingsGoalsRepo.update(db, id, { name: "Rainy day" });
		const [renamed] = await savingsGoalsQuery(db);
		expect(renamed.targetAmountUsd).toBe(before.targetAmountUsd);
		expect(renamed.name).toBe("Rainy day");

		await savingsGoalsRepo.update(db, id, { targetAmount: 6000 });
		const [raised] = await savingsGoalsQuery(db);
		expect(raised.targetAmount).toBe(6000);
	});

	it("goes with the account it tracks", async () => {
		// The goal has no meaning without the balance behind it, so the foreign key
		// cascades rather than leaving a target pointing at nothing.
		await goal();
		db.run?.("DELETE FROM accounts WHERE id = 'savings'");
		expect(await savingsGoalsQuery(db)).toStrictEqual([]);
	});

	it("refuses to update a goal that is not there", async () => {
		await expect(savingsGoalsRepo.update(db, "missing", { name: "x" })).rejects.toThrow("not found");
	});
});
