import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";
import { isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Database } from "@/db/client";
import { categories, tags, transactions, transactionTags } from "@/db/schema";
import { liveTagsQuery, tagIdsForQuery, tagsRepo } from "./tags-core";

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

async function seedTransaction(db: Database, id: string) {
	await db.insert(categories).values({
		id: "c1",
		name: "Food",
		income: false,
		sortOrder: 0,
		updatedAt: new Date(1),
	});
	await db.insert(transactions).values({
		id,
		amount: 10,
		income: false,
		note: "",
		date: new Date(1),
		day: new Date(1),
		month: new Date(1),
		categoryId: "c1",
		updatedAt: new Date(1),
	});
}

describe("tagsRepo", () => {
	let db: Database;

	beforeEach(async () => {
		db = migratedDb();
		await seedTransaction(db, "t1");
	});

	it("reuses a tag that already answers to the name", async () => {
		// Otherwise "Work" and "work" become two tags that look identical in every
		// list they appear in.
		const first = await tagsRepo.ensureTag(db, "Work");
		const second = await tagsRepo.ensureTag(db, "  work ");
		assert.equal(second, first);
		assert.equal((await liveTagsQuery(db)).length, 1);
	});

	it("keeps the casing the owner typed first", async () => {
		await tagsRepo.ensureTag(db, "WFH");
		await tagsRepo.ensureTag(db, "wfh");
		assert.equal((await liveTagsQuery(db))[0].name, "WFH");
	});

	it("refuses a name that is only whitespace", async () => {
		assert.equal(await tagsRepo.ensureTag(db, "   "), null);
		assert.equal((await liveTagsQuery(db)).length, 0);
	});

	it("attaches and detaches to match exactly what was asked for", async () => {
		const work = await tagsRepo.ensureTag(db, "work");
		const trip = await tagsRepo.ensureTag(db, "trip");
		assert.ok(work && trip);

		await tagsRepo.setTagsFor(db, "t1", [work, trip]);
		assert.equal((await tagIdsForQuery(db, "t1")).length, 2);

		await tagsRepo.setTagsFor(db, "t1", [work]);
		assert.deepEqual(
			(await tagIdsForQuery(db, "t1")).map((row) => row.tagId),
			[work],
		);
	});

	it("writes nothing when the same set is set again", async () => {
		const work = await tagsRepo.ensureTag(db, "work");
		assert.ok(work);
		await tagsRepo.setTagsFor(db, "t1", [work]);
		const before = await db.select().from(transactionTags);

		await tagsRepo.setTagsFor(db, "t1", [work]);

		const after = await db.select().from(transactionTags);
		assert.deepEqual(
			after.map((row) => row.updatedAt.getTime()),
			before.map((row) => row.updatedAt.getTime()),
		);
	});

	it("revives a detached link rather than making a second one", async () => {
		// The pair is unique, so a second row cannot exist — and reviving keeps the
		// identity the other devices already know.
		const work = await tagsRepo.ensureTag(db, "work");
		assert.ok(work);
		await tagsRepo.setTagsFor(db, "t1", [work]);
		await tagsRepo.setTagsFor(db, "t1", []);
		await tagsRepo.setTagsFor(db, "t1", [work]);

		const rows = await db.select().from(transactionTags);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].deletedAt, null);
	});

	it("retires the links when the tag itself goes", async () => {
		// A live link to a tombstoned tag reads as tagged and renders nothing.
		const work = await tagsRepo.ensureTag(db, "work");
		assert.ok(work);
		await tagsRepo.setTagsFor(db, "t1", [work]);

		await tagsRepo.deleteTag(db, work);

		assert.equal((await tagIdsForQuery(db, "t1")).length, 0);
		assert.equal((await liveTagsQuery(db)).length, 0);
	});

	it("leaves the tombstone replicable rather than dropping the row", async () => {
		const work = await tagsRepo.ensureTag(db, "work");
		assert.ok(work);
		await tagsRepo.deleteTag(db, work);

		const all = await db.select().from(tags);
		assert.equal(all.length, 1);
		assert.ok(all[0].deletedAt);
		assert.equal(all[0].name, "");
	});

	it("lets the same name be created again after a delete", async () => {
		const first = await tagsRepo.ensureTag(db, "work");
		assert.ok(first);
		await tagsRepo.deleteTag(db, first);

		const second = await tagsRepo.ensureTag(db, "work");
		assert.notEqual(second, first);
		assert.equal(
			(await db.select().from(tags).where(isNull(tags.deletedAt))).length,
			1,
		);
	});
});
