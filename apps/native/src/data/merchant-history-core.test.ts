import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";

import type { Database } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { testDatabase } from "@/db/test-database";
import { merchantKey } from "@/domain/merchant-resolver";

import { HISTORY_WINDOW, rememberedCategoryFor } from "./merchant-history-core";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "drizzle");

function makeDb(): Database {
    const sqlite = new BetterSqlite3(":memory:");
    for (const file of readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        for (const statement of readFileSync(join(MIGRATIONS, file), "utf-8").split("--> statement-breakpoint")) {
            if (statement.trim()) {
                sqlite.exec(statement);
            }
        }
    }
    return testDatabase(sqlite);
}

let db: Database;
let clock = 0;

function log(note: string, categoryId: string | null, options: { income?: boolean; deleted?: boolean } = {}): void {
    clock += 1;
    const date = new Date(clock * 1000);
    const income = options.income ?? false;
    if (categoryId != null) {
        db.insert(categories)
            .values({ id: categoryId, income, name: categoryId, sortOrder: 0, updatedAt: date })
            .onConflictDoNothing()
            .run();
    }
    db.insert(transactions)
        .values({
            amount: 10,
            categoryId,
            date,
            day: date,
            deletedAt: options.deleted === true ? date : null,
            id: `tx-${clock}`,
            income,
            month: date,
            note,
            updatedAt: date,
        })
        .run();
}

function remembered(name: string, income = false): Promise<string | null> {
    return rememberedCategoryFor(db, merchantKey(name), income);
}

beforeEach(() => {
    db = makeDb();
    clock = 0;
});

describe("reading a merchant's category back out of the ledger", () => {
    it("answers with the category the user filed it under", async () => {
        log("Rio Supermercado", "groceries");
        await expect(remembered("Rio Supermercado")).resolves.toBe("groceries");
    });

    it("matches an accented merchant typed without accents", async () => {
        // The reason the lookup reads a recency window instead of narrowing with
        // SQL LIKE: SQLite would not fold "Panadería" onto the normalised key.
        log("Panadería La Mejor", "food");
        await expect(remembered("Panaderia La Mejor")).resolves.toBe("food");
    });

    it("matches an unaccented merchant typed with accents", async () => {
        log("Panaderia La Mejor", "food");
        await expect(remembered("Panadería La Mejor")).resolves.toBe("food");
    });

    it("does not answer with a category from the other side of the ledger", async () => {
        log("Acme", "salary", { income: true });
        await expect(remembered("Acme", false)).resolves.toBeNull();
        await expect(remembered("Acme", true)).resolves.toBe("salary");
    });

    it("ignores deleted entries", async () => {
        log("Netflix", "entertainment", { deleted: true });
        await expect(remembered("Netflix")).resolves.toBeNull();
    });

    it("ignores entries that were never categorised", async () => {
        log("Netflix", null);
        await expect(remembered("Netflix")).resolves.toBeNull();
    });

    it("knows nothing about a merchant with no history", async () => {
        log("Netflix", "entertainment");
        await expect(remembered("Panaderia La Mejor")).resolves.toBeNull();
    });

    it("answers nothing for a name too short to normalise into a key", async () => {
        log("Netflix", "entertainment");
        await expect(remembered("   ")).resolves.toBeNull();
    });

    it("forgets a merchant pushed out of the recency window", async () => {
        log("Panaderia La Mejor", "food");
        for (let filler = 0; filler < HISTORY_WINDOW; filler += 1) {
            log(`Filler ${filler}`, "other");
        }
        await expect(remembered("Panaderia La Mejor")).resolves.toBeNull();
    });
});
