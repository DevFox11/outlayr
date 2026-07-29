import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import BetterSqlite3 from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import {
	budgets,
	categories,
	mainBudget,
	templateTransactions,
	transactions,
} from "@/db/schema";
import { seedCategories } from "./categories-core";
import {
	type AdoptionEngine,
	adoptedAccount,
	localLedgerState,
	markAdopted,
	runAdoption,
} from "./ledger-adoption";
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

async function addTransaction(
	target: Database,
	id: string,
	deletedAt: Date | null = null,
): Promise<void> {
	const now = new Date();
	await target.insert(transactions).values({
		id,
		amount: 12,
		income: false,
		date: now,
		day: now,
		month: now,
		updatedAt: now,
		deletedAt,
	});
}

let db: Database;

beforeEach(async () => {
	db = makeDb();
	await seedCategories(db);
});

describe("local ledger state", () => {
	it("reads a freshly seeded install as empty", async () => {
		assert.equal(await localLedgerState(db), "empty");
	});

	it("errs toward populated on an install that was never seeded", async () => {
		const bare = makeDb();
		assert.equal(await localLedgerState(bare), "populated");
	});

	it("reads a single transaction as populated", async () => {
		await addTransaction(db, "t1");
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a transaction deleted offline as populated", async () => {
		await addTransaction(db, "t1", new Date());
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a budget as populated", async () => {
		const [first] = await db.select().from(categories).limit(1);
		await db.insert(budgets).values({
			id: "b1",
			amount: 100,
			type: 0,
			categoryId: first?.id ?? null,
			updatedAt: new Date(),
		});
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a main budget as populated", async () => {
		await db
			.insert(mainBudget)
			.values({ id: "m1", amount: 100, type: 0, updatedAt: new Date() });
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a template transaction as populated", async () => {
		await db.insert(templateTransactions).values({
			id: "tt1",
			amount: 5,
			income: false,
			updatedAt: new Date(),
		});
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a renamed category as populated", async () => {
		const [first] = await db.select().from(categories).limit(1);
		await db
			.update(categories)
			.set({ name: "Renamed", updatedAt: new Date(Date.now() + 1000) })
			.where(eq(categories.id, first?.id ?? ""));
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads a deleted category as populated", async () => {
		const [first] = await db.select().from(categories).limit(1);
		await db
			.update(categories)
			.set({ deletedAt: new Date() })
			.where(eq(categories.id, first?.id ?? ""));
		assert.equal(await localLedgerState(db), "populated");
	});

	it("reads an added category as populated", async () => {
		const now = new Date();
		await db.insert(categories).values({
			id: "c-new",
			name: "Mine",
			dateCreated: now,
			updatedAt: now,
		});
		assert.equal(await localLedgerState(db), "populated");
	});
});

describe("adoption marker", () => {
	it("is absent before any account has been reconciled", async () => {
		assert.equal(await adoptedAccount(db), null);
	});

	it("holds the account it was resolved for", async () => {
		await markAdopted(db, "user_a");
		assert.equal(await adoptedAccount(db), "user_a");
	});

	it("is replaced when a different account signs in", async () => {
		await markAdopted(db, "user_a");
		await markAdopted(db, "user_b");
		assert.equal(await adoptedAccount(db), "user_b");
	});
});

function recordingEngine(): AdoptionEngine & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		accountLedger: async () => {
			calls.push("accountLedger");
			return "populated";
		},
		replaceFromAccount: async () => {
			calls.push("replaceFromAccount");
		},
		discardAccountLedger: async () => {
			calls.push("discardAccountLedger");
		},
	};
}

describe("running an adoption", () => {
	it("opens the sync gate without queueing when there is nothing to push", async () => {
		await runAdoption(db, null, {
			pushLocal: false,
			wipeLocal: false,
			wipeAccount: false,
		});
		assert.equal(await isSyncEnabled(db), true);
		assert.equal(await outboxPendingCount(db), 0);
	});

	it("queues every local row when adopting", async () => {
		await addTransaction(db, "t1");
		await runAdoption(db, null, {
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: false,
		});
		assert.equal(await isSyncEnabled(db), true);
		assert.ok((await outboxPendingCount(db)) > 1);
	});

	it("refuses a destructive plan with no engine to run it through", async () => {
		await assert.rejects(() =>
			runAdoption(db, null, {
				pushLocal: false,
				wipeLocal: true,
				wipeAccount: false,
			}),
		);
		await assert.rejects(() =>
			runAdoption(db, null, {
				pushLocal: true,
				wipeLocal: false,
				wipeAccount: true,
			}),
		);
		assert.equal(await isSyncEnabled(db), false);
		assert.equal(await outboxPendingCount(db), 0);
	});

	it("refills from the account before the gate opens, so the wipe queues nothing", async () => {
		await addTransaction(db, "t1");
		const engine = recordingEngine();
		engine.replaceFromAccount = async () => {
			engine.calls.push("replaceFromAccount");
			assert.equal(await isSyncEnabled(db), false);
		};
		await runAdoption(db, engine, {
			pushLocal: false,
			wipeLocal: true,
			wipeAccount: false,
		});
		assert.deepEqual(engine.calls, ["replaceFromAccount"]);
		assert.equal(await isSyncEnabled(db), true);
		assert.equal(await outboxPendingCount(db), 0);
	});

	it("discards the account's ledger before queueing this device's", async () => {
		await addTransaction(db, "t1");
		const engine = recordingEngine();
		await runAdoption(db, engine, {
			pushLocal: true,
			wipeLocal: false,
			wipeAccount: true,
		});
		assert.deepEqual(engine.calls, ["discardAccountLedger"]);
		assert.ok((await outboxPendingCount(db)) > 1);
	});

	it("leaves both sides untouched when the engine refuses", async () => {
		await addTransaction(db, "t1");
		const engine = recordingEngine();
		engine.discardAccountLedger = async () => {
			throw new Error("offline");
		};
		await assert.rejects(() =>
			runAdoption(db, engine, {
				pushLocal: true,
				wipeLocal: false,
				wipeAccount: true,
			}),
		);
		assert.equal(await isSyncEnabled(db), false);
		assert.equal(await outboxPendingCount(db), 0);
	});
});
