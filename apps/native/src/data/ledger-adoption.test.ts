import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { accounts, budgets, categories, mainBudget, templateTransactions, transactions } from "@/db/schema";
import { seedCategories } from "./categories-core";
import { type AdoptionEngine, adoptedAccount, localLedgerState, markAdopted, runAdoption } from "./ledger-adoption";
import { isSyncEnabled, outboxPendingCount } from "./sync-outbox-core";

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
		expect(await localLedgerState(db)).toBe("empty");
	});

	it("errs toward populated on an install that was never seeded", async () => {
		const bare = makeDb();
		expect(await localLedgerState(bare)).toBe("populated");
	});

	it("reads a single transaction as populated", async () => {
		await addTransaction(db, "t1");
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads a transaction deleted offline as populated", async () => {
		await addTransaction(db, "t1", new Date());
		expect(await localLedgerState(db)).toBe("populated");
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
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads a main budget as populated", async () => {
		await db.insert(mainBudget).values({ amount: 100, id: "m1", type: 0, updatedAt: new Date() });
		expect(await localLedgerState(db)).toBe("populated");
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
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads a template transaction as populated", async () => {
		await db.insert(templateTransactions).values({
			amount: 5,
			id: "tt1",
			income: false,
			updatedAt: new Date(),
		});
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads a renamed category as populated", async () => {
		const [first] = await db.select().from(categories).limit(1);
		await db
			.update(categories)
			.set({ name: "Renamed", updatedAt: new Date(Date.now() + 1000) })
			.where(eq(categories.id, first?.id ?? ""));
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads a deleted category as populated", async () => {
		const [first] = await db.select().from(categories).limit(1);
		await db
			.update(categories)
			.set({ deletedAt: new Date() })
			.where(eq(categories.id, first?.id ?? ""));
		expect(await localLedgerState(db)).toBe("populated");
	});

	it("reads an added category as populated", async () => {
		const now = new Date();
		await db.insert(categories).values({
			dateCreated: now,
			id: "c-new",
			name: "Mine",
			updatedAt: now,
		});
		expect(await localLedgerState(db)).toBe("populated");
	});
});

describe("adoption marker", () => {
	it("is absent before any account has been reconciled", async () => {
		expect(await adoptedAccount(db)).toBe(null);
	});

	it("holds the account it was resolved for", async () => {
		await markAdopted(db, "user_a");
		expect(await adoptedAccount(db)).toBe("user_a");
	});

	it("is replaced when a different account signs in", async () => {
		await markAdopted(db, "user_a");
		await markAdopted(db, "user_b");
		expect(await adoptedAccount(db)).toBe("user_b");
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
		await runAdoption(db, null, {
			pushLocal: false,
			wipeAccount: false,
			wipeLocal: false,
		});
		expect(await isSyncEnabled(db)).toBe(true);
		expect(await outboxPendingCount(db)).toBe(0);
	});

	it("queues every local row when adopting", async () => {
		await addTransaction(db, "t1");
		await runAdoption(db, null, {
			pushLocal: true,
			wipeAccount: false,
			wipeLocal: false,
		});
		expect(await isSyncEnabled(db)).toBe(true);
		expect((await outboxPendingCount(db)) > 1).toBeTruthy();
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
		expect(await isSyncEnabled(db)).toBe(false);
		expect(await outboxPendingCount(db)).toBe(0);
	});

	it("refills from the account before the gate opens, so the wipe queues nothing", async () => {
		await addTransaction(db, "t1");
		const engine = recordingEngine();
		engine.replaceFromAccount = async () => {
			engine.calls.push("replaceFromAccount");
			expect(await isSyncEnabled(db)).toBe(false);
		};
		await runAdoption(db, engine, {
			pushLocal: false,
			wipeAccount: false,
			wipeLocal: true,
		});
		expect(engine.calls).toStrictEqual(["replaceFromAccount"]);
		expect(await isSyncEnabled(db)).toBe(true);
		expect(await outboxPendingCount(db)).toBe(0);
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
		expect(await isSyncEnabled(db)).toBe(false);
		expect(await outboxPendingCount(db)).toBe(0);
	});
});
