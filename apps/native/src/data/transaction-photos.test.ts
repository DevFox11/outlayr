import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";

const MIGRATIONS = join(import.meta.dirname, "../../drizzle");

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
        for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
            if (statement.trim()) {
                sqlite.exec(statement);
            }
        }
    }
}

function applyOne(sqlite: BetterSqlite3.Database, file: string): void {
    for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
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
    columns: { imageUri?: string | null; imageKey?: string | null }
): void {
    sqlite
        .prepare(
            `INSERT INTO transactions
			 (id, amount, income, note, date, day, month, categoryId, imageUri, imageKey, imageColor, updatedAt)
			 VALUES (?, 10, 0, '', 1, 1, 1, 'c1', ?, ?, '#abcdef', 1)`
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
            imageKey: "transaction-photos/u1/a.jpg",
            imageUri: "file:///photos/a.jpg",
        });

        applyOne(sqlite, PHOTOS_MIGRATION);

        const rows = sqlite.prepare("SELECT * FROM transactionPhotos").all() as Record<string, unknown>[];
        expect(rows).toHaveLength(1);
        expect(rows[0].transactionId).toBe("t1");
        expect(rows[0].imageUri).toBe("file:///photos/a.jpg");
        expect(rows[0].imageKey).toBe("transaction-photos/u1/a.jpg");
        expect(rows[0].imageColor).toBe("#abcdef");
        expect(rows[0].sortOrder).toBe(0);
    });

    it("carries a row that has a key but no local file", () => {
        // A photo the account holds that this device has not fetched yet.
        const sqlite = ledgerBeforeThePhotosTable();
        insertTransaction(sqlite, "t1", {
            imageKey: "transaction-photos/u1/a.jpg",
            imageUri: null,
        });

        applyOne(sqlite, PHOTOS_MIGRATION);

        const rows = sqlite.prepare("SELECT * FROM transactionPhotos").all();
        expect(rows).toHaveLength(1);
    });

    it("leaves an entry that never had a photo alone", () => {
        const sqlite = ledgerBeforeThePhotosTable();
        insertTransaction(sqlite, "t1", { imageKey: null, imageUri: null });

        applyOne(sqlite, PHOTOS_MIGRATION);

        expect(sqlite.prepare("SELECT * FROM transactionPhotos").all()).toStrictEqual([]);
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
        expect(new Set(ids).size).toBe(2);
    });
});
