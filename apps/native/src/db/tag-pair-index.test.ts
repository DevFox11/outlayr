import { beforeEach, describe, expect, it } from "@jest/globals";
import BetterSqlite3 from "better-sqlite3";

import { applyMigrations } from "@/db/test-database";

/**
 * `transactionTags_pair_idx` is the app's only constraint on a tag link; the
 * server has none and addresses links by `localId`. So the index has to allow
 * exactly what the sync applier will hand it and forbid what the UI must never
 * write, and those two are not the same rule.
 */
describe("the live-link pair index", () => {
    let sqlite: BetterSqlite3.Database;

    beforeEach(() => {
        sqlite = new BetterSqlite3(":memory:");
        applyMigrations(sqlite);
        sqlite
            .prepare(
                "INSERT INTO transactions (id, amount, income, note, date, day, month, " +
                    "onceRecurring, recurringType, recurringCoefficient, updatedAt) " +
                    "VALUES ('t1', 1, 0, '', 1, 1, 1, 0, 0, 1, 1)"
            )
            .run();
        sqlite.prepare("INSERT INTO tags (id, name, sortOrder, updatedAt) VALUES ('g1', 'coffee', 0, 1)").run();
    });

    const link = (id: string, deletedAt: number | null) =>
        sqlite
            .prepare(
                "INSERT INTO transactionTags (id, transactionId, tagId, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?)"
            )
            .run(id, "t1", "g1", 1, deletedAt);

    it("lets a link from another device land on a pair this device retired", () => {
        link("a", 2);

        expect(() => link("b", null)).not.toThrow();
        expect(sqlite.prepare("SELECT COUNT(*) AS n FROM transactionTags").get()).toStrictEqual({ n: 2 });
    });

    it("holds two retired links for the same pair, because both devices may have tombstoned it", () => {
        link("a", 2);

        expect(() => link("b", 3)).not.toThrow();
    });

    it("still refuses a second live link for the pair", () => {
        link("a", null);

        expect(() => link("b", null)).toThrow(/UNIQUE constraint failed/);
    });
});
