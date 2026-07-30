import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import BetterSqlite3 from "better-sqlite3";

const MIGRATIONS = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../drizzle",
);

function migrationFiles(): string[] {
	return readdirSync(MIGRATIONS)
		.filter((name) => name.endsWith(".sql"))
		.sort();
}

function applyUpTo(sqlite: BetterSqlite3.Database, stopBefore: string): void {
	for (const file of migrationFiles()) {
		if (file === stopBefore) {
			return;
		}
		for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
			"--> statement-breakpoint",
		)) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}
}

function applyOne(sqlite: BetterSqlite3.Database, file: string): void {
	for (const statement of readFileSync(join(MIGRATIONS, file), "utf8").split(
		"--> statement-breakpoint",
	)) {
		if (statement.trim()) {
			sqlite.exec(statement);
		}
	}
}

const PHOTOS_MIGRATION = "0011_transaction_photos.sql";

/**
 * Driven through raw SQL rather than drizzle, because the point is what the
 * migration does to a database written by the PREVIOUS build — a schema drizzle
 * no longer describes.
 */
function ledgerBeforeThePhotosTable(): BetterSqlite3.Database {
	const sqlite = new BetterSqlite3(":memory:");
	applyUpTo(sqlite, PHOTOS_MIGRATION);
	sqlite.exec(`
		INSERT INTO categories (id, name, income, sortOrder, updatedAt)
		VALUES ('c1', 'Food', 0, 0, 1);
	`);
	return sqlite;
}

function insertTransaction(
	sqlite: BetterSqlite3.Database,
	id: string,
	columns: { imageUri?: string | null; imageKey?: string | null },
): void {
	sqlite
		.prepare(
			`INSERT INTO transactions
			 (id, amount, income, note, date, day, month, categoryId, imageUri, imageKey, imageColor, updatedAt)
			 VALUES (?, 10, 0, '', 1, 1, 1, 'c1', ?, ?, '#abcdef', 1)`,
		)
		.run(id, columns.imageUri ?? null, columns.imageKey ?? null);
}

describe("moving existing photos into their own table", () => {
	it("carries a stored photo across rather than orphaning it", () => {
		// Without the backfill the new table starts empty and every photo already
		// on a device is unreachable: the old column still holds the key, and
		// nothing reads that column any more.
		const sqlite = ledgerBeforeThePhotosTable();
		insertTransaction(sqlite, "t1", {
			imageUri: "file:///photos/a.jpg",
			imageKey: "transaction-photos/u1/a.jpg",
		});

		applyOne(sqlite, PHOTOS_MIGRATION);

		const rows = sqlite
			.prepare("SELECT * FROM transactionPhotos")
			.all() as Record<string, unknown>[];
		assert.equal(rows.length, 1);
		assert.equal(rows[0].transactionId, "t1");
		assert.equal(rows[0].imageUri, "file:///photos/a.jpg");
		assert.equal(rows[0].imageKey, "transaction-photos/u1/a.jpg");
		assert.equal(rows[0].imageColor, "#abcdef");
		assert.equal(rows[0].sortOrder, 0);
	});

	it("carries a row that has a key but no local file", () => {
		// A photo the account holds that this device has not fetched yet.
		const sqlite = ledgerBeforeThePhotosTable();
		insertTransaction(sqlite, "t1", {
			imageUri: null,
			imageKey: "transaction-photos/u1/a.jpg",
		});

		applyOne(sqlite, PHOTOS_MIGRATION);

		const rows = sqlite.prepare("SELECT * FROM transactionPhotos").all();
		assert.equal(rows.length, 1);
	});

	it("leaves an entry that never had a photo alone", () => {
		const sqlite = ledgerBeforeThePhotosTable();
		insertTransaction(sqlite, "t1", { imageUri: null, imageKey: null });

		applyOne(sqlite, PHOTOS_MIGRATION);

		assert.deepEqual(
			sqlite.prepare("SELECT * FROM transactionPhotos").all(),
			[],
		);
	});

	it("gives every carried photo a distinct id", () => {
		const sqlite = ledgerBeforeThePhotosTable();
		insertTransaction(sqlite, "t1", { imageUri: "file:///a.jpg" });
		insertTransaction(sqlite, "t2", { imageUri: "file:///b.jpg" });

		applyOne(sqlite, PHOTOS_MIGRATION);

		const ids = (
			sqlite.prepare("SELECT id FROM transactionPhotos").all() as {
				id: string;
			}[]
		).map((row) => row.id);
		assert.equal(new Set(ids).size, 2);
	});
});
